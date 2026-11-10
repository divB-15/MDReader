import { useEffect } from 'react'
import { useStore } from '../store'
import { renderMarkdown } from '../lib/markdown'
import type { Doc } from '../lib/types'

/** Renders the active document once, and keeps its html/headings in the store. */
export function useDocumentRender(doc: Doc | null): void {
  useEffect(() => {
    if (!doc) return
    if (doc.state === 'ready') return
    let cancelled = false
    const docId = doc.id
    const content = doc.content
    useStore.getState().updateDoc(docId, { state: 'rendering' })
    renderMarkdown(content)
      .then((result) => {
        if (cancelled) return
        useStore.getState().updateDoc(docId, { html: result.html, headings: result.headings, state: 'ready' })
      })
      .catch((error) => {
        if (cancelled) return
        useStore.getState().updateDoc(docId, { state: 'error', error: String(error) })
      })
    return () => {
      cancelled = true
    }
    // `content` is part of the key so that re-opening a file that changed on
    // disk renders the new text instead of the cached html.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, doc?.content])
}
