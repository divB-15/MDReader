import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useStore } from '../store'

export default function SearchBar() {
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const close = () => setUI({ searchOpen: false, query: '', hits: 0, current: 0, searchJump: 0 })
  const step = (delta: number) => {
    if (!ui.hits) return
    // Typing only highlights; the first Enter moves to the first hit.
    if (ui.searchJump < 1) {
      setUI({ current: 1, searchJump: 1 })
      return
    }
    const next = ((ui.current - 1 + delta + ui.hits) % ui.hits) + 1
    setUI({ current: next, searchJump: ui.searchJump + 1 })
  }

  return (
    <div className="searchbar">
      <Search size={15} className="searchbar-icon" />
      <input
        ref={inputRef}
        value={ui.query}
        placeholder="在文档中搜索"
        onChange={(event) => setUI({ query: event.target.value, current: 1, searchJump: 0 })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            step(event.shiftKey ? -1 : 1)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
      />
      <span className="searchbar-count">
        {ui.hits
          ? ui.searchJump > 0
            ? `${ui.current} / ${ui.hits}`
            : `共 ${ui.hits} 处`
          : ui.query
            ? '无匹配'
            : ''}
      </span>
      <button className="icon-btn small" title="上一个 (Shift+Enter)" onClick={() => step(-1)} disabled={!ui.hits}>
        <ChevronUp size={15} />
      </button>
      <button className="icon-btn small" title="下一个 (Enter)" onClick={() => step(1)} disabled={!ui.hits}>
        <ChevronDown size={15} />
      </button>
      <button className="icon-btn small" title="关闭 (Esc)" onClick={close}>
        <X size={15} />
      </button>
    </div>
  )
}
