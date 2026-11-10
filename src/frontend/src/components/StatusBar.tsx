import { useMemo } from 'react'
import { useStore } from '../store'
import { countReadingStats } from '../lib/markdown'

export default function StatusBar() {
  const active = useStore((s) => s.docs.find((d) => d.id === s.activeId) || null)
  const progress = useStore((s) => s.ui.progress)
  const stats = useMemo(() => (active ? countReadingStats(active.content) : null), [active?.content])

  if (!active || !stats) {
    return (
      <footer className="statusbar">
        <span>准备就绪</span>
        <span className="status-right">MDReader</span>
      </footer>
    )
  }

  return (
    <footer className="statusbar">
      <span>
        约 {stats.words.toLocaleString('zh-CN')} 字 · 阅读约 {stats.minutes} 分钟
      </span>
      <span className="status-right">
        <span className="status-dim">{active.provider === 'host' ? '本地文件' : '内存文档'}</span>
        <span className="status-progress">已读 {Math.round(progress * 100)}%</span>
      </span>
    </footer>
  )
}
