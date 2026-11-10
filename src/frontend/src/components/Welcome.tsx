import { BookOpen, FilePlus2, FolderOpen, Sparkles, Clock } from 'lucide-react'
import { useStore } from '../store'

interface Props {
  onOpenFile: () => void
  onOpenFolder: () => void
  onOpenSample: () => void
}

export default function Welcome({ onOpenFile, onOpenFolder, onOpenSample }: Props) {
  const recent = useStore((s) => s.recent)
  const clearRecent = useStore((s) => s.clearRecent)

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-brand">
          <span className="welcome-mark">
            <BookOpen size={26} />
          </span>
          <h1>MDReader</h1>
        </div>
        <p className="welcome-sub">轻快打开，安心阅读。把 Markdown 排成你喜欢的样子。</p>

        <div className="welcome-actions">
          <button className="btn primary" onClick={onOpenFile}>
            <FilePlus2 size={16} />
            打开文件
          </button>
          <button className="btn" onClick={onOpenFolder}>
            <FolderOpen size={16} />
            打开文件夹
          </button>
          <button className="btn" onClick={onOpenSample}>
            <Sparkles size={16} />
            查看示例
          </button>
        </div>

        <div className="welcome-drop">把 .md 文件或整个文件夹拖进来</div>

        {recent.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-head">
              <span>
                <Clock size={13} /> 最近打开
              </span>
              <button onClick={clearRecent}>清空</button>
            </div>
            {recent.slice(0, 6).map((entry) => (
              <button
                key={entry.path}
                className="welcome-recent-item"
                title={entry.path}
                onClick={() => window.dispatchEvent(new CustomEvent('mdreader:open-path', { detail: entry.path }))}
              >
                <span className="welcome-recent-name">{entry.name}</span>
                <span className="welcome-recent-path">{entry.path}</span>
              </button>
            ))}
          </div>
        )}

        <div className="welcome-shortcuts">
          <span><kbd>Ctrl</kbd>+<kbd>O</kbd> 打开文件</span>
          <span><kbd>Ctrl</kbd>+<kbd>F</kbd> 搜索</span>
          <span><kbd>Ctrl</kbd>+<kbd>B</kbd> 侧栏</span>
          <span><kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>-</kbd> 字号</span>
          <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> 主题</span>
        </div>
      </div>
    </div>
  )
}
