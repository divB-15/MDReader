import { useEffect } from 'react'
import { useStore } from '../store'

interface ShortcutHandlers {
  onOpenFile: () => void
  onOpenFolder: () => void
}

export function useShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useStore.getState()
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      // The image viewer owns the keyboard while it is open (arrows, +/-, 0/1);
      // otherwise Ctrl+= would zoom the text behind the overlay as well.
      if (state.viewer.open && event.key !== 'Escape') return

      if (mod && key === 'o') {
        event.preventDefault()
        if (event.shiftKey) handlers.onOpenFolder()
        else handlers.onOpenFile()
        return
      }
      if (mod && key === 'f') {
        event.preventDefault()
        if (state.docs.length) state.setUI({ searchOpen: true, current: 1, searchJump: 0 })
        return
      }
      if (mod && key === 'b') {
        event.preventDefault()
        state.toggleSidebar()
        return
      }
      if (mod && key === 'w') {
        event.preventDefault()
        state.closeActive()
        return
      }
      if (mod && event.shiftKey && key === 't') {
        event.preventDefault()
        state.cycleTheme()
        return
      }
      if (mod && event.shiftKey && key === 'm') {
        event.preventDefault()
        state.toggleFocus()
        return
      }
      if (mod && (key === '=' || key === '+')) {
        event.preventDefault()
        state.patchSettings({ fontSize: Math.min(25, state.settings.fontSize + 1) })
        return
      }
      if (mod && key === '-') {
        event.preventDefault()
        state.patchSettings({ fontSize: Math.max(14, state.settings.fontSize - 1) })
        return
      }
      if (mod && key === '0') {
        event.preventDefault()
        state.patchSettings({ fontSize: 17 })
        return
      }
      if (mod && event.key === 'Tab') {
        event.preventDefault()
        if (state.docs.length > 1) {
          const index = state.docs.findIndex((doc) => doc.id === state.activeId)
          const next = (index + (event.shiftKey ? -1 : 1) + state.docs.length) % state.docs.length
          state.setActive(state.docs[next].id)
        }
        return
      }
      if (event.key === 'Escape') {
        if (state.viewer.open) {
          state.closeViewer()
        } else if (state.ui.settingsOpen) {
          state.setUI({ settingsOpen: false })
        } else if (state.ui.searchOpen) {
          state.setUI({ searchOpen: false, query: '', hits: 0, current: 0, searchJump: 0 })
        } else if (state.settings.focus) {
          state.toggleFocus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers.onOpenFile, handlers.onOpenFolder])
}
