import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  FileText,
  Folder,
  X,
} from 'lucide-react'
import { useStore } from '../store'
import { scrollToHeading } from '../lib/nav'
import {
  buildTocTree,
  collapseAll,
  expandToFirstLevel,
  tocBranches,
  toggleBranch,
  type TocNode,
} from '../lib/toc'
import type { FileInfo } from '../lib/types'

interface TreeNode {
  name: string
  file?: FileInfo
  children: TreeNode[]
}

function buildTree(files: FileInfo[]): TreeNode[] {
  const root: TreeNode = { name: '', children: [] }
  for (const file of files) {
    const parts = file.rel.split('/')
    let cursor = root
    parts.forEach((part, index) => {
      const leaf = index === parts.length - 1
      let next = cursor.children.find((child) => child.name === part && !!child.file === leaf)
      if (!next) {
        next = { name: part, children: [], file: leaf ? file : undefined }
        cursor.children.push(next)
      }
      cursor = next
    })
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (!!a.file !== !!b.file) return a.file ? 1 : -1
      return a.name.localeCompare(b.name, 'zh-Hans-CN')
    })
    nodes.forEach((node) => sort(node.children))
    return nodes
  }
  return sort(root.children)
}

function openByPath(path: string) {
  window.dispatchEvent(new CustomEvent('mdreader:open-path', { detail: path }))
}

function Rows({ nodes, depth, activePath }: { nodes: TreeNode[]; depth: number; activePath: string }) {
  return (
    <>
      {nodes.map((node) =>
        node.file ? (
          <button
            key={node.file.path}
            className={`side-item file ${node.file.path === activePath ? 'is-active' : ''}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            title={node.file.path}
            onClick={() => openByPath(node.file!.path)}
          >
            <FileText size={13} />
            <span>{node.name.replace(/\.(md|markdown|mdown|mkd|mdx|txt)$/i, '')}</span>
          </button>
        ) : (
          <div key={`${node.name}-${depth}`} className="side-folder">
            <div className="side-folder-name" style={{ paddingLeft: 10 + depth * 14 }}>
              <Folder size={13} />
              <span>{node.name}</span>
            </div>
            <Rows nodes={node.children} depth={depth + 1} activePath={activePath} />
          </div>
        ),
      )}
    </>
  )
}

interface TocRowsProps {
  nodes: TocNode[]
  depth: number
  activeHeading: string
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
}

/**
 * One outline row plus, when it is a section and open, its children. The row is
 * a flex box of two buttons — nesting a button inside a button is invalid HTML
 * and React would warn about it.
 */
function TocRows({ nodes, depth, activeHeading, collapsed, onToggle }: TocRowsProps) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        const closed = hasChildren && collapsed.has(node.id)
        const isActive = node.id === activeHeading
        return (
          <div key={node.id}>
            <div
              className={`toc-row ${isActive ? 'is-active' : ''}`}
              data-heading={node.id}
              style={{ paddingLeft: 6 + depth * 13 }}
            >
              {hasChildren ? (
                <button
                  className={`toc-toggle ${closed ? '' : 'is-open'}`}
                  title={closed ? '展开' : '折叠'}
                  aria-expanded={!closed}
                  onClick={() => onToggle(node.id)}
                >
                  <ChevronRight size={12} />
                </button>
              ) : (
                <span className="toc-toggle is-leaf" aria-hidden="true" />
              )}
              <button
                className="side-item toc"
                title={node.text}
                onClick={() => scrollToHeading(node.id)}
              >
                <span>{node.text}</span>
              </button>
            </div>
            {hasChildren && !closed && (
              <TocRows
                nodes={node.children}
                depth={depth + 1}
                activeHeading={activeHeading}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

export default function Sidebar() {
  const folder = useStore((s) => s.folder)
  const recent = useStore((s) => s.recent)
  const active = useStore((s) => s.docs.find((d) => d.id === s.activeId) || null)
  const activeHeading = useStore((s) => s.ui.activeHeading)
  const setFolder = useStore((s) => s.setFolder)
  const clearRecent = useStore((s) => s.clearRecent)
  const tocRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const toc = useMemo(
    () => (active?.headings.length ? buildTocTree(active.headings) : []),
    [active?.headings],
  )
  // A flat outline has nothing to fold, so the three icons stay hidden instead
  // of doing nothing when clicked.
  const foldable = useMemo(() => tocBranches(toc).length > 0, [toc])

  // Folded sections are per-document: carrying them over to the next file would
  // hide headings the user never touched there.
  useEffect(() => {
    setCollapsed(new Set())
  }, [active?.id])

  // Keep the current entry inside the visible part of the outline, the way an
  // editor keeps the symbol list in sync while you scroll.
  useEffect(() => {
    if (!activeHeading || !tocRef.current) return
    const rows = tocRef.current.querySelectorAll<HTMLElement>('.toc-row')
    for (const row of rows) {
      if (row.dataset.heading === activeHeading) {
        row.scrollIntoView({ block: 'nearest' })
        break
      }
    }
  }, [activeHeading, collapsed])

  const tree = folder && folder.files.length ? buildTree(folder.files) : null

  return (
    <aside className="sidebar">
      <section className="side-section side-files">
        <div className="side-head">
          <span className="side-head-title">{folder ? folder.name : '文档'}</span>
          {folder && (
            <button className="side-mini" title="关闭文件夹" onClick={() => setFolder(null)}>
              <X size={13} />
            </button>
          )}
        </div>
        <div className="side-body">
          {tree ? (
            <Rows nodes={tree} depth={0} activePath={active?.path || ''} />
          ) : recent.length ? (
            <>
              {recent.map((entry) => (
                <button
                  key={entry.path}
                  className={`side-item file ${entry.path === active?.path ? 'is-active' : ''}`}
                  title={entry.path}
                  onClick={() => openByPath(entry.path)}
                >
                  <FileText size={13} />
                  <span>{entry.name.replace(/\.(md|markdown|mdown|mkd|mdx|txt)$/i, '')}</span>
                </button>
              ))}
              <button className="side-clear" onClick={clearRecent}>
                清空记录
              </button>
            </>
          ) : (
            <div className="side-empty">打开文件夹后，这里会列出所有文档</div>
          )}
        </div>
      </section>

      <section className="side-section side-toc">
        <div className="side-head">
          <span className="side-head-title">目录</span>
          {foldable && (
            <div className="side-tools">
              {/* One arrow family, read from coarse to fine: double-down = all
                  the way open, single-down = one level, double-up = all closed.
                  Two chevrons pointing at each other (the usual "collapse"
                  glyph) collapse into an ✕ at 13 px and look like a delete. */}
              <button
                className="side-mini"
                title="全部展开"
                onClick={() => setCollapsed(new Set())}
              >
                <ChevronsDown size={13} />
              </button>
              <button
                className="side-mini"
                title="展开到第一层"
                onClick={() => setCollapsed(expandToFirstLevel(toc))}
              >
                <ChevronDown size={13} />
              </button>
              <button
                className="side-mini"
                title="全部折叠"
                onClick={() => setCollapsed(collapseAll(toc))}
              >
                <ChevronsUp size={13} />
              </button>
            </div>
          )}
        </div>
        <div className="side-body" ref={tocRef}>
          {toc.length ? (
            <TocRows
              nodes={toc}
              depth={0}
              activeHeading={activeHeading}
              collapsed={collapsed}
              onToggle={(id) => setCollapsed((prev) => toggleBranch(prev, id))}
            />
          ) : (
            <div className="side-empty">这份文档没有标题</div>
          )}
        </div>
      </section>

      <div className="side-foot">
        <span>
          <kbd>Ctrl</kbd> + <kbd>B</kbd> 收起侧栏
        </span>
      </div>
    </aside>
  )
}
