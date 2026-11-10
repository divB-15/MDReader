import { BookOpen, FilePlus2, FolderOpen, Focus, Search, Settings, Sun, Moon } from 'lucide-react'
import { useStore } from '../store'

interface Props {
  onOpenFile: () => void
  onOpenFolder: () => void
}

export default function Toolbar({ onOpenFile, onOpenFolder }: Props) {
  const settings = useStore((s) => s.settings)
  const active = useStore((s) => s.docs.find((d) => d.id === s.activeId) || null)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const toggleFocus = useStore((s) => s.toggleFocus)
  const cycleTheme = useStore((s) => s.cycleTheme)
  const setUI = useStore((s) => s.setUI)
  const searchOpen = useStore((s) => s.ui.searchOpen)
  const settingsOpen = useStore((s) => s.ui.settingsOpen)

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <button className={`icon-btn ${settings.sidebar ? 'is-on' : ''}`} title="侧栏 (Ctrl+B)" onClick={toggleSidebar}>
          <BookOpen size={17} />
        </button>
        <div className="doc-title" title={active?.path || ''}>
          {active?.name || 'MDReader'}
        </div>
      </div>

      <div className="toolbar-right">
        <button className="icon-btn" title="打开文件 (Ctrl+O)" onClick={onOpenFile}>
          <FilePlus2 size={17} />
        </button>
        <button className="icon-btn" title="打开文件夹 (Ctrl+Shift+O)" onClick={onOpenFolder}>
          <FolderOpen size={17} />
        </button>
        <button
          className={`icon-btn ${searchOpen ? 'is-on' : ''}`}
          title="搜索 (Ctrl+F)"
          onClick={() => setUI({ searchOpen: true, current: 1, searchJump: 0 })}
        >
          <Search size={17} />
        </button>
        <div className="toolbar-sep" />
        <button className="icon-btn" title="切换主题 (Ctrl+Shift+T)" onClick={cycleTheme}>
          {settings.theme === 'night' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button className="icon-btn" title="专注模式 (Ctrl+Shift+M)" onClick={toggleFocus}>
          <Focus size={17} />
        </button>
        <button className={`icon-btn ${settingsOpen ? 'is-on' : ''}`} title="阅读设置" onClick={() => setUI({ settingsOpen: !settingsOpen })}>
          <Settings size={17} />
        </button>
      </div>
    </header>
  )
}
