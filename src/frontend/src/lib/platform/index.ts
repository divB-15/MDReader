import type { DocSource, FolderListing } from '../types'
import type { WindowInit } from '../hostCommands'
import { normalizeWindowInit, tabTransferPayload } from '../hostCommands'
import {
  isDesktop,
  openHostFile,
  openHostFolder,
  openHostPath,
  openHostUrl,
  readHostImage,
  setHostTitle,
  setHostTopmost,
  hostWindowInit,
  hostTabDrop,
  hostWindowAction,
} from './host'
import {
  adoptEntries,
  entriesFromDataTransfer,
  filesToEntries,
  pickFiles,
  readMemoryDoc,
  readMemoryImage,
  resetMemoryFolder,
  singleDocFromFile,
} from './memory'
import { joinPath } from './paths'

export type OpenResult =
  | { kind: 'doc'; doc: DocSource }
  | { kind: 'folder'; listing: FolderListing; first: DocSource | null }
  | null

export const platform = {
  isDesktop,

  async openFile(): Promise<OpenResult> {
    if (isDesktop()) {
      const doc = await openHostFile()
      return doc ? { kind: 'doc', doc } : null
    }
    const files = await pickFiles(false)
    if (!files.length) return null
    return { kind: 'doc', doc: await singleDocFromFile(files[0]) }
  },

  async openFolder(): Promise<OpenResult> {
    if (isDesktop()) {
      const listing = await openHostFolder()
      return listing ? { kind: 'folder', listing, first: null } : null
    }
    const files = await pickFiles(true)
    if (!files.length) return null
    const adopted = await adoptEntries(filesToEntries(files), true)
    if (!adopted) return { kind: 'folder', listing: { root: '', name: '', files: [] }, first: null }
    return { kind: 'folder', listing: adopted.listing, first: adopted.first }
  },

  // Files dropped on the window arrive without real paths, even in the desktop
  // shell, so a dropped folder is ingested exactly like a browser folder pick.
  async ingestDrop(items: DataTransferItemList | null, files: File[]): Promise<OpenResult> {
    let entries = await entriesFromDataTransfer(items)
    if (!entries.length) {
      entries = files.map((file) => ({
        path: (file.webkitRelativePath || file.name).replace(/\\/g, '/'),
        file,
      }))
    }
    const hasFolder = entries.some((entry) => entry.path.includes('/'))
    if (hasFolder) {
      const adopted = await adoptEntries(entries, true)
      if (!adopted) return null
      return { kind: 'folder', listing: adopted.listing, first: adopted.first }
    }
    const md = entries.find((entry) => /\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(entry.path)) || entries[0]
    if (!md) return null
    return { kind: 'doc', doc: await singleDocFromFile(md.file) }
  },

  async openPath(path: string): Promise<DocSource | null> {
    if (isDesktop()) return openHostPath(path)
    return readMemoryDoc(path)
  },

  async readImage(doc: DocSource, src: string): Promise<string | null> {
    const absolute = joinPath(doc.dir, src)
    if (doc.provider === 'host') {
      return isDesktop() ? readHostImage(absolute) : null
    }
    return readMemoryImage(absolute)
  },

  async openExternal(url: string): Promise<void> {
    if (isDesktop()) {
      await openHostUrl(url)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  },

  setTitle(title: string): void {
    document.title = title
    if (isDesktop()) setHostTitle(title)
  },

  /** Only the desktop shell can pin its own window; browsers ignore this. */
  setAlwaysOnTop(on: boolean): void {
    if (isDesktop()) setHostTopmost(on)
  },

  /**
   * Startup protocol for one window. In a browser (Vite dev) there is no host,
   * so nothing is restored and no commands are queued.
   */
  async windowInit(): Promise<WindowInit> {
    if (!isDesktop()) return { windowId: 0, restore: false, commands: [] }
    try {
      return normalizeWindowInit(await hostWindowInit())
    } catch {
      return { windowId: 0, restore: false, commands: [] }
    }
  },

  /**
   * A tab was released after being dragged. The host decides whether the drop
   * lands on another MDReader window (merge) or on empty screen (new window);
   * it also removes the tab from this window afterwards.
   */
  async tabDrop(doc: DocSource, x: number, y: number, last: boolean): Promise<void> {
    if (!isDesktop()) return
    try {
      await hostTabDrop(x, y, last, JSON.stringify(tabTransferPayload(doc)), doc.id)
    } catch {
      // The bridge rejected the call; the tab stays where it is.
    }
  },

  async windowAction(action: 'minimize' | 'maximize' | 'close' | 'fullscreen'): Promise<void> {
    if (isDesktop()) await hostWindowAction(action)
  },

  resetFolder(): void {
    resetMemoryFolder()
  },
}

export { baseName, dirOf, isAbsolutePath, isMarkdownPath, joinPath, normalizeSrc } from './paths'
