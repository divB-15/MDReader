import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useStore } from '../store'
import { platform } from '../lib/platform'
import { dropIndex, markerIndex } from '../lib/tabs'

interface DragState {
  id: string
  name: string
  pointerId: number
  startX: number
  startY: number
  started: boolean
}

interface Ghost {
  name: string
  x: number
  y: number
  outside: boolean
}

/**
 * Where the pointer is right now, and what a release would do:
 * `bar` reorders, `inside` is a no-op, `outside` tears the tab off.
 */
interface DropTarget {
  zone: 'bar' | 'inside' | 'outside'
  /** Insertion index in the list without the dragged tab; only for `bar`. */
  index: number
}

const DRAG_THRESHOLD = 6
// The reorder zone is the 34px bar plus some slack: users aim at the tab strip
// in a hurry and a one-pixel miss should not silently cancel the drag.
const BAR_SLACK_TOP = 10
const BAR_SLACK_BOTTOM = 28

export default function TabBar() {
  const docs = useStore((s) => s.docs)
  const activeId = useStore((s) => s.activeId)
  const setActive = useStore((s) => s.setActive)
  const closeDoc = useStore((s) => s.closeDoc)
  const moveDoc = useStore((s) => s.moveDoc)
  const barRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const drop = useRef<DropTarget | null>(null)
  const suppressClick = useRef(false)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  // The bar is permanent while any document is open: with exactly one tab it
  // still carries that tab's close button. Only the empty state (Welcome page)
  // has no bar at all.
  if (docs.length === 0) return null

  const outsideViewport = (x: number, y: number) =>
    x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight

  const locate = (x: number, y: number, dragged: number): DropTarget => {
    if (outsideViewport(x, y)) return { zone: 'outside', index: dragged }
    const bar = barRef.current
    if (!bar) return { zone: 'inside', index: dragged }
    const rect = bar.getBoundingClientRect()
    const inBar =
      y >= rect.top - BAR_SLACK_TOP &&
      y <= rect.bottom + BAR_SLACK_BOTTOM &&
      x >= rect.left - 8 &&
      x <= rect.right + 8
    if (!inBar) return { zone: 'inside', index: dragged }
    // getBoundingClientRect already accounts for the bar's horizontal scroll,
    // so the centres stay valid while the strip is scrolled.
    const centers = Array.from(bar.querySelectorAll<HTMLElement>('.tab')).map((tab) => {
      const box = tab.getBoundingClientRect()
      return box.left + box.width / 2
    })
    return { zone: 'bar', index: dropIndex(centers, x, dragged) }
  }

  const begin = (
    event: ReactPointerEvent<HTMLDivElement>,
    id: string,
    name: string,
  ) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.tab-close')) return
    event.preventDefault()
    // Pointer capture keeps pointermove/pointerup coming even while the cursor
    // is outside this WebView2 window, which is how a tear-off is detected.
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      id,
      name,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    }
  }

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    if (
      !state.started &&
      Math.hypot(event.clientX - state.startX, event.clientY - state.startY) <
        DRAG_THRESHOLD
    ) {
      return
    }
    state.started = true
    const index = docs.findIndex((doc) => doc.id === state.id)
    const target = locate(event.clientX, event.clientY, index)
    drop.current = target
    setDragId(state.id)
    if (target.zone === 'bar') {
      // Reordering is previewed by a drop line between tabs, not by a floating
      // label: the tab itself is still on screen right under the cursor.
      setGhost(null)
      setDropAt(target.index)
    } else {
      setDropAt(null)
      setGhost({
        name: state.name,
        x: event.clientX,
        y: event.clientY,
        outside: target.zone === 'outside',
      })
    }
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancel = false) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    const target = drop.current
    drag.current = null
    drop.current = null
    setGhost(null)
    setDragId(null)
    setDropAt(null)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Capture can already be gone when the window loses focus mid-drag.
    }
    if (!state.started) {
      if (!cancel) setActive(state.id)
      return
    }
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
    if (cancel) return
    const from = docs.findIndex((doc) => doc.id === state.id)
    if (target?.zone === 'bar') {
      // Released on the strip: this is a reorder, never a tear-off. A drop that
      // maps back to the original slot is simply a no-op.
      if (from >= 0 && target.index !== from) moveDoc(state.id, target.index)
      return
    }
    // Released inside this window but off the strip, or outside it entirely.
    // The host does the hit-testing (other window / desktop), which also covers
    // "dropped on the same window" as a cancellation.
    const doc = docs.find((item) => item.id === state.id)
    if (!doc) return
    void platform.tabDrop(
      doc,
      Math.round(event.clientX),
      Math.round(event.clientY),
      docs.length === 1,
    )
  }

  const lostCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    // pointerup normally clears `drag` first; reaching here with it still set
    // means the drag was interrupted, so leave the tab where it is.
    if (drag.current) finish(event, true)
  }

  const draggedIndex = dragId ? docs.findIndex((doc) => doc.id === dragId) : -1
  const marker =
    dropAt !== null && draggedIndex >= 0 ? markerIndex(dropAt, draggedIndex) : null

  const markerClass = (index: number) => {
    if (marker === null) return ''
    if (marker === index) return 'is-drop-before'
    // A marker past the last tab means "drop at the end".
    if (marker >= docs.length && index === docs.length - 1) return 'is-drop-after'
    return ''
  }

  return (
    <>
      <div className="tabbar" ref={barRef}>
        {docs.map((doc, index) => (
          <div
            key={doc.id}
            className={`tab ${doc.id === activeId ? 'is-active' : ''} ${
              doc.id === dragId ? 'is-dragging' : ''
            } ${markerClass(index)}`}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={(event) => begin(event, doc.id, doc.name)}
            onPointerMove={move}
            onPointerUp={(event) => finish(event)}
            onLostPointerCapture={lostCapture}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false
                return
              }
              setActive(doc.id)
            }}
            title={doc.path}
          >
            <span className="tab-name">{doc.name}</span>
            <button
              className="tab-close"
              title="关闭 (Ctrl+W)"
              onClick={(event) => {
                event.stopPropagation()
                closeDoc(doc.id)
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {ghost &&
        createPortal(
          <div
            className={`tab-ghost ${ghost.outside ? 'is-outside' : ''}`}
            style={{ left: ghost.x + 14, top: ghost.y + 14 }}
          >
            <span className="tab-ghost-name">{ghost.name}</span>
            <span className="tab-ghost-hint">
              {ghost.outside
                ? '松手：为这个标签开一个新窗口'
                : '拖到标签栏可调整顺序，拖到窗口外可分离'}
            </span>
          </div>,
          document.body,
        )}
    </>
  )
}
