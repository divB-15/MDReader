import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, Minimize, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useStore } from '../store'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export default function ImageViewer() {
  const viewer = useStore((s) => s.viewer)
  const closeViewer = useStore((s) => s.closeViewer)
  const setViewerIndex = useStore((s) => s.setViewerIndex)

  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const viewRef = useRef({ scale: 1, x: 0, y: 0 })
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [fitMode, setFitMode] = useState(true)
  const [dragging, setDragging] = useState(false)

  const item = viewer.open ? viewer.gallery[viewer.index] : null
  const total = viewer.gallery.length

  useEffect(() => {
    viewRef.current = { scale, x: pos.x, y: pos.y }
  }, [scale, pos])

  useEffect(() => {
    setScale(1)
    setPos({ x: 0, y: 0 })
    setFitMode(true)
  }, [viewer.index, viewer.open])

  const fit = () => {
    const stage = stageRef.current
    const img = imgRef.current
    if (!stage || !img) return
    const sw = stage.clientWidth - 80
    const sh = stage.clientHeight - 80
    const iw = img.naturalWidth || sw
    const ih = img.naturalHeight || sh
    const next = Math.min(sw / iw, sh / ih, 1)
    setScale(next)
    setPos({ x: 0, y: 0 })
    setFitMode(true)
  }

  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const cx = clientX !== undefined ? clientX - rect.left - rect.width / 2 : 0
    const cy = clientY !== undefined ? clientY - rect.top - rect.height / 2 : 0
    const current = viewRef.current
    const next = clamp(current.scale * factor, 0.15, 8)
    const ratio = next / current.scale
    setScale(next)
    setPos({
      x: cx - (cx - current.x) * ratio,
      y: cy - (cy - current.y) * ratio,
    })
    setFitMode(false)
  }

  const toggle = () => {
    if (fitMode) {
      setScale(1)
      setPos({ x: 0, y: 0 })
      setFitMode(false)
    } else {
      fit()
    }
  }

  const step = (delta: number) => {
    if (!total) return
    setViewerIndex((viewer.index + delta + total) % total)
  }

  useEffect(() => {
    if (!viewer.open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeViewer()
      } else if (event.key === 'ArrowLeft') {
        step(-1)
      } else if (event.key === 'ArrowRight') {
        step(1)
      } else if (event.key === '=' || event.key === '+') {
        zoomAt(1.2)
      } else if (event.key === '-') {
        zoomAt(0.8)
      } else if (event.key === '0') {
        fit()
      } else if (event.key === '1') {
        setScale(1)
        setPos({ x: 0, y: 0 })
        setFitMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer.open, viewer.index, total])

  useEffect(() => {
    if (!viewer.open) return
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.deltaY < 0 ? 1.12 : 0.89, event.clientX, event.clientY)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [viewer.open])

  if (!viewer.open || !item) return null

  return (
    <div className="viewer" role="dialog" aria-modal="true">
      <div className="viewer-top">
        <div className="viewer-meta">
          <span className="viewer-index">
            {viewer.index + 1} / {total}
          </span>
          {item.alt && <span className="viewer-title">{item.alt}</span>}
        </div>
        <div className="viewer-actions">
          <span className="viewer-zoom">{Math.round(scale * 100)}%</span>
          <button className="viewer-btn" title="缩小 (-)" onClick={() => zoomAt(0.8)}>
            <ZoomOut size={17} />
          </button>
          <button className="viewer-btn" title="放大 (+)" onClick={() => zoomAt(1.25)}>
            <ZoomIn size={17} />
          </button>
          <button className="viewer-btn" title={fitMode ? '原始大小 (1)' : '适应窗口 (0)'} onClick={toggle}>
            {fitMode ? <Maximize size={17} /> : <Minimize size={17} />}
          </button>
          <button className="viewer-btn" title="关闭 (Esc)" onClick={closeViewer}>
            <X size={17} />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`viewer-stage ${dragging ? 'is-dragging' : ''}`}
        onMouseDown={(event) => {
          if (event.target === stageRef.current) closeViewer()
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          if ((event.target as HTMLElement).closest('button')) return
          const current = viewRef.current
          dragRef.current = { px: event.clientX, py: event.clientY, x: current.x, y: current.y }
          setDragging(true)
          ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) return
          setPos({ x: drag.x + (event.clientX - drag.px), y: drag.y + (event.clientY - drag.py) })
        }}
        onPointerUp={() => {
          dragRef.current = null
          setDragging(false)
        }}
        onPointerCancel={() => {
          dragRef.current = null
          setDragging(false)
        }}
      >
        {total > 1 && (
          <button
            className="viewer-nav left"
            title="上一张 (←)"
            onClick={(event) => {
              event.stopPropagation()
              step(-1)
            }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <img
          ref={imgRef}
          className="viewer-image"
          src={item.src}
          alt={item.alt}
          draggable={false}
          onLoad={fit}
          onDoubleClick={toggle}
          style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})` }}
        />
        {total > 1 && (
          <button
            className="viewer-nav right"
            title="下一张 (→)"
            onClick={(event) => {
              event.stopPropagation()
              step(1)
            }}
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  )
}
