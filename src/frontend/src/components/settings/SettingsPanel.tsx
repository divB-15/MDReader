import { useEffect, useRef } from 'react'
import { useStore, type ThemeName } from '../../store'
import { platform } from '../../lib/platform'
import FontSection from './FontSection'
import IndentSection from './IndentSection'

const THEMES: { key: ThemeName; label: string }[] = [
  { key: 'paper', label: '纸白' },
  { key: 'sepia', label: '护眼' },
  { key: 'night', label: '夜间' },
]

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="set-row">
      <span className="set-label">
        {label}
        <em>
          {value}
          {suffix}
        </em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export default function SettingsPanel() {
  const settings = useStore((s) => s.settings)
  const patch = useStore((s) => s.patchSettings)
  const reset = useStore((s) => s.resetSettings)
  const setUI = useStore((s) => s.setUI)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (panelRef.current?.contains(target)) return
      if (target.closest('.toolbar')) return
      setUI({ settingsOpen: false })
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [setUI])

  return (
    <div className="settings-panel" ref={panelRef}>
      <div className="set-head">
        <span>阅读设置</span>
        <button className="set-reset" onClick={reset}>
          恢复默认
        </button>
      </div>

      <div className="set-group">
        <div className="set-caption">主题</div>
        <div className="set-seg">
          {THEMES.map((theme) => (
            <button
              key={theme.key}
              className={settings.theme === theme.key ? 'is-on' : ''}
              onClick={() => patch({ theme: theme.key })}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <FontSection settings={settings} patch={patch} />

      <Slider
        label="字号"
        value={settings.fontSize}
        min={14}
        max={25}
        step={1}
        suffix="px"
        onChange={(value) => patch({ fontSize: value })}
      />
      <Slider
        label="行高"
        value={Number(settings.lineHeight.toFixed(2))}
        min={1.4}
        max={2.2}
        step={0.05}
        suffix=""
        onChange={(value) => patch({ lineHeight: value })}
      />
      <Slider
        label="版心宽度"
        value={settings.measure}
        min={560}
        max={1400}
        step={20}
        suffix="px"
        onChange={(value) => patch({ measure: value })}
      />
      <Slider
        label="段间距"
        value={Number(settings.paragraphGap.toFixed(1))}
        min={0.3}
        max={1.8}
        step={0.1}
        suffix="em"
        onChange={(value) => patch({ paragraphGap: value })}
      />

      <IndentSection settings={settings} patch={patch} />

      <div className="set-switches">
        <label className="set-switch">
          <input
            type="checkbox"
            checked={settings.justify}
            onChange={(event) => patch({ justify: event.target.checked })}
          />
          <span>两端对齐</span>
        </label>
        <label className="set-switch">
          <input
            type="checkbox"
            checked={settings.codeWrap}
            onChange={(event) => patch({ codeWrap: event.target.checked })}
          />
          <span>代码换行</span>
        </label>
        <label className="set-switch">
          <input
            type="checkbox"
            checked={settings.codeNumbers}
            onChange={(event) => patch({ codeNumbers: event.target.checked })}
          />
          <span>代码行号</span>
        </label>
        {platform.isDesktop() && (
          <label className="set-switch" title="让窗口始终显示在其他程序之上，便于边看边写">
            <input
              type="checkbox"
              checked={settings.alwaysOnTop}
              onChange={(event) => patch({ alwaysOnTop: event.target.checked })}
            />
            <span>窗口置顶</span>
          </label>
        )}
      </div>
    </div>
  )
}
