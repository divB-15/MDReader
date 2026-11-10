import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { moveItem } from '../lib/tabs'
import type { Doc, DocSource, FolderListing, RecentEntry } from '../lib/types'
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './settings'

export type {
  FontRole,
  FontPreset,
  IndentSettings,
  RoleFont,
  Settings,
  ThemeName,
} from './settings'
export {
  DEFAULT_SETTINGS,
  LATIN_PRESETS,
  CJK_PRESETS,
  ROLE_LABELS,
  fontStackFor,
} from './settings'

/**
 * Zustand writes on every state change, including the scroll-driven progress
 * updates. Only the persisted slice matters, so identical payloads are dropped
 * before they reach localStorage (a synchronously flushed, per-frame write).
 */
function dedupeStorage(): StateStorage {
  let last = ''
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      if (value === last) return
      last = value
      localStorage.setItem(name, value)
    },
    removeItem: (name) => {
      last = ''
      localStorage.removeItem(name)
    },
  }
}

interface ViewerState {
  open: boolean
  gallery: { src: string; alt: string }[]
  index: number
}

interface UIState {
  searchOpen: boolean
  query: string
  hits: number
  current: number
  /** Bumped only when the user asks to jump to a hit; 0 means "not yet". */
  searchJump: number
  settingsOpen: boolean
  activeHeading: string
  progress: number
  dragging: boolean
}

interface MDReaderState {
  settings: Settings
  docs: Doc[]
  activeId: string | null
  recent: RecentEntry[]
  lastDocPath: string
  folder: FolderListing | null
  viewer: ViewerState
  ui: UIState
  toast: string

  patchSettings: (patch: Partial<Settings>) => void
  resetSettings: () => void
  toggleSidebar: () => void
  toggleFocus: () => void
  cycleTheme: () => void

  openDoc: (source: DocSource) => Doc
  closeDoc: (id: string) => void
  closeActive: () => void
  setActive: (id: string) => void
  /**
   * Moves a tab inside the bar. `to` is an index into the list *without* the
   * dragged tab, which is what the pointer arithmetic in `lib/tabs` produces.
   */
  moveDoc: (id: string, to: number) => void
  updateDoc: (id: string, patch: Partial<Doc>) => void

  /** Applied to another window's localStorage write; never touches open tabs. */
  syncPersisted: (
    patch: Partial<Pick<MDReaderState, 'settings' | 'recent' | 'lastDocPath'>>,
  ) => void
  pushRecent: (entry: RecentEntry) => void
  clearRecent: () => void
  setFolder: (folder: FolderListing | null) => void

  setUI: (patch: Partial<UIState>) => void
  openViewer: (gallery: { src: string; alt: string }[], index: number) => void
  closeViewer: () => void
  setViewerIndex: (index: number) => void

  showToast: (message: string) => void
}

export const useStore = create<MDReaderState>()(
  persist(    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      docs: [],
      activeId: null,
      recent: [],
      lastDocPath: '',
      folder: null,
      viewer: { open: false, gallery: [], index: 0 },
      ui: {
        searchOpen: false,
        query: '',
        hits: 0,
        current: 0,
        searchJump: 0,
        settingsOpen: false,
        activeHeading: '',
        progress: 0,
        dragging: false,
      },
      toast: '',

      patchSettings: (patch) =>
        set((state) => {
          const merged: Settings = {
            ...state.settings,
            ...patch,
            fonts: { ...state.settings.fonts, ...(patch.fonts || {}) },
            indent: { ...state.settings.indent, ...(patch.indent || {}) },
          }
          return { settings: normalizeSettings(merged) }
        }),
      resetSettings: () => set({ settings: normalizeSettings(DEFAULT_SETTINGS) }),
      toggleSidebar: () => set((s) => ({ settings: { ...s.settings, sidebar: !s.settings.sidebar } })),
      toggleFocus: () => set((s) => ({ settings: { ...s.settings, focus: !s.settings.focus } })),
      cycleTheme: () =>
        set((s) => {
          const order = ['paper', 'sepia', 'night'] as const
          const next = order[(order.indexOf(s.settings.theme) + 1) % order.length]
          return { settings: { ...s.settings, theme: next } }
        }),

      openDoc: (source) => {
        const existing = get().docs.find((doc) => doc.id === source.id)
        if (existing) {
          // Re-opening a document that already has a tab refreshes it as well:
          // the file may have been edited on disk since the tab was created.
          const changed = existing.content !== source.content
          const next: Doc = changed
            ? {
                ...existing,
                content: source.content,
                html: '',
                headings: [],
                state: 'idle',
                error: undefined,
              }
            : existing
          set((s) => ({
            activeId: existing.id,
            // A dropped file has no path the next launch could reopen.
            lastDocPath: source.provider === 'host' ? source.path : s.lastDocPath,
            docs: changed
              ? s.docs.map((doc) => (doc.id === existing.id ? next : doc))
              : s.docs,
          }))
          return next
        }
        const doc: Doc = { ...source, html: '', headings: [], state: 'idle' }
        set((s) => ({
          docs: [...s.docs, doc],
          activeId: doc.id,
          lastDocPath: source.provider === 'host' ? source.path : s.lastDocPath,
        }))
        return doc
      },

      closeDoc: (id) =>
        set((s) => {
          const docs = s.docs.filter((doc) => doc.id !== id)
          let activeId = s.activeId
          if (activeId === id) {
            const index = s.docs.findIndex((doc) => doc.id === id)
            activeId = docs[Math.min(index, docs.length - 1)]?.id ?? null
          }
          // Closing the final tab is an explicit "I'm done with this document".
          // Forget the auto-reopen path too, otherwise the next launch silently
          // brings back the file the user just closed. The "recent" list keeps
          // it available from the Welcome page.
          const lastDocPath = docs.length === 0 ? '' : s.lastDocPath
          return {
            docs,
            activeId,
            lastDocPath,
            ui: { ...s.ui, searchOpen: false, query: '', hits: 0, current: 0, searchJump: 0 },
          }
        }),

      closeActive: () => {
        const id = get().activeId
        if (id) get().closeDoc(id)
      },

      setActive: (id) =>
        set((s) => ({ activeId: id, ui: { ...s.ui, searchOpen: false, query: '', hits: 0, current: 0, searchJump: 0 } })),

      moveDoc: (id, to) =>
        set((s) => {
          const from = s.docs.findIndex((doc) => doc.id === id)
          if (from < 0) return {}
          // The active tab is tracked by id, so reordering never switches
          // documents — it only changes where the tab is drawn.
          const target = Math.max(0, Math.min(to, s.docs.length - 1))
          if (target === from) return {}
          return { docs: moveItem(s.docs, from, target) }
        }),

      updateDoc: (id, patch) =>
        set((s) => ({ docs: s.docs.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)) })),

      syncPersisted: (patch) => set(patch),

      pushRecent: (entry) =>
        set((s) => {
          const recent = s.recent.filter((item) => item.path !== entry.path)
          return { recent: [entry, ...recent].slice(0, 12) }
        }),
      clearRecent: () => set({ recent: [] }),
      setFolder: (folder) => set({ folder }),

      setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
      openViewer: (gallery, index) => set({ viewer: { open: true, gallery, index } }),
      closeViewer: () => set({ viewer: { open: false, gallery: [], index: 0 } }),
      setViewerIndex: (index) =>
        set((s) => ({
          viewer: { ...s.viewer, index: Math.max(0, Math.min(index, s.viewer.gallery.length - 1)) },
        })),

      showToast: (message) => {
        set({ toast: message })
        window.setTimeout(() => {
          if (get().toast === message) set({ toast: '' })
        }, 2600)
      },
    }),
    {
      name: 'mdreader:v1',
      storage: createJSONStorage(dedupeStorage),
      partialize: (s) => ({
        settings: s.settings,
        recent: s.recent,
        lastDocPath: s.lastDocPath,
      }),
      merge: (persisted, current) => {
        const previous = persisted as Partial<MDReaderState>
        return {
          ...current,
          recent: previous.recent || [],
          lastDocPath: previous.lastDocPath || '',
          settings: normalizeSettings(previous.settings),
          ui: current.ui,
          docs: [],
          activeId: null,
          folder: null,
          viewer: current.viewer,
          toast: '',
        }
      },
    },
  ),
)
