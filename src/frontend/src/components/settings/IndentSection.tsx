import type { Settings } from '../../store'

interface Props {
  settings: Settings
  patch: (patch: Partial<Settings>) => void
}

const ROWS: { key: keyof Settings['indent']; label: string; hint?: string }[] = [
  { key: 'body', label: '正文段落' },
  { key: 'quote', label: '引用段落' },
  { key: 'list', label: '列表项' },
  { key: 'code', label: '代码块左侧', hint: '不参与首行缩进' },
]

export default function IndentSection({ settings, patch }: Props) {
  return (
    <div className="set-group">
      <div className="set-caption">段落缩进</div>
      {ROWS.map((row) => (
        <div className="set-indent-row" key={row.key}>
          <span className="set-indent-label">
            {row.label}
            {row.hint && <em>{row.hint}</em>}
          </span>
          <input
            type="range"
            min={0}
            max={4}
            step={0.5}
            value={settings.indent[row.key]}
            onChange={(event) =>
              patch({ indent: { ...settings.indent, [row.key]: Number(event.target.value) } })
            }
          />
          <span className="set-indent-value">{settings.indent[row.key]}em</span>
        </div>
      ))}
      <p className="set-hint">中文正文常用 2em；代码块不应用首行缩进，此处只控制左侧留白。</p>
    </div>
  )
}
