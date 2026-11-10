import { useCallback, useEffect } from 'react'
import { Minimize2, Upload } from 'lucide-react'
import { useStore, type Settings } from './store'
import { platform } from './lib/platform'
import type { DocSource, RecentEntry } from './lib/types'
import type { OpenResult } from './lib/platform'
import { transferredToSource, type HostCommand } from './lib/hostCommands'
import { SAMPLE_MARKDOWN } from './lib/sample'
import { useDocumentRender } from './hooks/useDocumentRender'
import { useTypography } from './hooks/useTypography'
import { useShortcuts } from './hooks/useShortcuts'
import { useDragDrop } from './hooks/useDragDrop'
import Toolbar from './components/Toolbar'
import TabBar from './components/TabBar'
import Sidebar from './components/Sidebar'
import Reader from './components/Reader'
import SearchBar from './components/SearchBar'
import SettingsPanel from './components/settings/SettingsPanel'
import StatusBar from './components/StatusBar'
import Welcome from './components/Welcome'
import ImageViewer from './components/ImageViewer'

const SAMPLE_SOURCE: DocSource = {
  id: 'sample:mdreader',
  path: '示例文档.md',
  name: '示例文档.md',
  dir: '',
  content: SAMPLE_MARKDOWN,
  provider: 'memory',
}

export default function App() {
  const active = useStore((s) => s.docs.find((doc) => doc.id === s.activeId) || null)
  const settings = useStore((s) => s.settings)
  const ui = useStore((s) => s.ui)
  const toast = useStore((s) => s.toast)
  const setFolder = useStore((s) => s.setFolder)

  useTypography()
  useDocumentRender(active)

  const openSource = useCallback((source: DocSource) => {
    const state = useStore.getState()
    state.openDoc(source)
    if (source.provider === 'host') {
      state.pushRecent({ path: source.path, name: source.name, dir: source.dir, at: Date.now() })
    }
  }, [])

  const openByPath = useCallback(
    async (path: string) => {
      const source = await platform.openPath(path)
      if (source) openSource(source)
      else useStore.getState().showToast('打不开这个文件')
    },
    [openSource],
  )

  /** One entry point for everything the host pushes into a window. */
  const handleCommand = useCallback(
    async (command: HostCommand) => {
      if (command.type === 'open') {
        await openByPath(command.path)
        return
      }
      if (command.type === 'add') {
        const source = transferredToSource(command.doc)
        if (source) openSource(source)
        else await openByPath(command.doc.path)
        return
      }
      if (command.type === 'remove') {
        useStore.getState().closeDoc(command.id)
        return
      }
      if (command.type === 'toast') {
        useStore.getState().showToast(command.text)
      }
    },
    [openByPath, openSource],
  )

  const applyOpenResult = useCallback(
    async (result: OpenResult) => {
      if (!result) return
      if (result.kind === 'folder') {
        setFolder(result.listing)
        if (result.first) openSource(result.first)
        else if (result.listing.files.length) await openByPath(result.listing.files[0].path)
      } else {
        openSource(result.doc)
      }
    },
    [openByPath, openSource, setFolder],
  )

  const handleOpenFile = useCallback(async () => {
    await applyOpenResult(await platform.openFile())
  }, [applyOpenResult])

  const handleOpenFolder = useCallback(async () => {
    await applyOpenResult(await platform.openFolder())
  }, [applyOpenResult])

  const handleOpenSample = useCallback(() => openSource(SAMPLE_SOURCE), [openSource])

  useShortcuts({ onOpenFile: handleOpenFile, onOpenFolder: handleOpenFolder })
  useDragDrop(applyOpenResult)

  /* --------------------------------- startup --------------------------------- */

  useEffect(() => {
    let mounted = true
    // The host can push a command before the page has mounted (a command-line
    // file, a second launch, a tab dragged in from another window). Install the
    // receiver first, then acknowledge readiness so queued commands can drain.
    const target = window as Window & {
      __mrHostMessage?: (command: HostCommand) => void
    }
    target.__mrHostMessage = (command) => {
      if (mounted) void handleCommand(command)
    }
    const start = async () => {
      try {
        const init = await platform.windowInit()
        if (!mounted) return
        for (const command of init.commands) {
          if (!mounted) return
          await handleCommand(command)
        }
        // An explicit startup document or a hand-over wins over "reopen last".
        if (init.commands.length) return
        if (init.restore && platform.isDesktop()) {
          const last = useStore.getState().lastDocPath
          if (last) {
            const doc = await platform.openPath(last)
            if (mounted && doc) openSource(doc)
          }
        }
      } catch {
        // A missing or unreadable last document must not leave a blank window
        // with no explanation.
        if (mounted) useStore.getState().showToast('打开上次的文档失败')
      }
    }
    void start()
    return () => {
      mounted = false
      delete target.__mrHostMessage
    }
  }, [handleCommand, openSource])

  /* ------------------------------- open by path ------------------------------- */

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === 'string') void handleCommand({ type: 'open', path: detail })
    }
    window.addEventListener('mdreader:open-path', handler)
    return () => window.removeEventListener('mdreader:open-path', handler)
  }, [handleCommand])

  /* ------------------------- shared settings between windows ------------------------ */

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'mdreader:v1' || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue) as { state?: Record<string, unknown> }
        const incoming = parsed?.state
        if (!incoming) return
        const current = useStore.getState()
        const patch: { settings?: Settings; recent?: RecentEntry[]; lastDocPath?: string } = {}
        if (incoming.settings && JSON.stringify(incoming.settings) !== JSON.stringify(current.settings)) {
          patch.settings = incoming.settings as Settings
        }
        if (Array.isArray(incoming.recent) && JSON.stringify(incoming.recent) !== JSON.stringify(current.recent)) {
          patch.recent = incoming.recent as RecentEntry[]
        }
        if (typeof incoming.lastDocPath === 'string' && incoming.lastDocPath !== current.lastDocPath) {
          patch.lastDocPath = incoming.lastDocPath
        }
        // Writing back an identical payload terminates the ping-pong: the next
        // storage event compares equal and produces no patch.
        if (Object.keys(patch).length) current.syncPersisted(patch)
      } catch {
        // Another window wrote something we cannot parse: ignore it.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* ----------------------------------- title ---------------------------------- */

  useEffect(() => {
    platform.setTitle(active ? `${active.name} — MDReader` : 'MDReader')
  }, [active?.name])

  /* ----------------------------------- render ---------------------------------- */

  return (
    <div className="app" data-focus={settings.focus ? '1' : '0'}>
      {!settings.focus && (
        <>
          <Toolbar onOpenFile={handleOpenFile} onOpenFolder={handleOpenFolder} />
          {/* One document is already a tab. Hiding the bar until a second file
              arrives changes the window layout mid-use and leaves the only tab
              without a close button. TabBar returns null when nothing is open. */}
          <TabBar />
        </>
      )}

      <div className="workspace">
        {!settings.focus && settings.sidebar && <Sidebar />}
        <main className="main">
          <div className="progress-rail">
            <span style={{ width: `${Math.round(ui.progress * 1000) / 10}%` }} />
          </div>
          {active ? (
            <Reader key={active.id} doc={active} />
          ) : (
            <Welcome
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onOpenSample={handleOpenSample}
            />
          )}
        </main>
      </div>

      {!settings.focus && <StatusBar />}

      {settings.focus && (
        <button className="focus-exit" onClick={() => useStore.getState().toggleFocus()}>
          <Minimize2 size={14} />
          退出专注
        </button>
      )}

      {ui.searchOpen && active && <SearchBar />}
      {ui.settingsOpen && <SettingsPanel />}
      <ImageViewer />

      {ui.dragging && (
        <div className="drop-overlay">
          <div className="drop-card">
            <Upload size={26} />
            <p>松手即可打开</p>
            <span>支持 .md 文件、整个文件夹，以及文件夹里的图片</span>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
