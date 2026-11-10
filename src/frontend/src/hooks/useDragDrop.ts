import { useEffect } from 'react'
import { useStore } from '../store'
import { platform, type OpenResult } from '../lib/platform'

/** Accepts files and folders dropped anywhere on the window. */
export function useDragDrop(applyOpenResult: (result: OpenResult) => void | Promise<void>): void {
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes('Files')

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      useStore.getState().setUI({ dragging: true })
    }
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) useStore.getState().setUI({ dragging: false })
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      useStore.getState().setUI({ dragging: false })
      const files = Array.from(event.dataTransfer?.files || [])
      if (!files.length && !(event.dataTransfer?.items.length || 0)) return
      void platform.ingestDrop(event.dataTransfer?.items || null, files).then((result) => {
        if (!result) useStore.getState().showToast('没有找到可读的 Markdown 文件')
        else void applyOpenResult(result)
      })
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [applyOpenResult])
}
