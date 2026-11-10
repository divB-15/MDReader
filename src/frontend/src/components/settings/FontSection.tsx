import type { FontRole, RoleFont, Settings } from '../../store'
import { CJK_PRESETS, LATIN_PRESETS, ROLE_LABELS } from '../../store'

interface Props {
  settings: Settings
  patch: (patch: Partial<Settings>) => void
}

const ROLES: FontRole[] = ['body', 'heading', 'quote', 'code']

export default function FontSection({ settings, patch }: Props) {
  const update = (role: FontRole, patchFont: Partial<RoleFont>) => {
    patch({ fonts: { ...settings.fonts, [role]: { ...settings.fonts[role], ...patchFont } } })
  }

  return (
    <div className="set-group">
      <div className="set-caption">字体（中文与西文分别设置）</div>
      {ROLES.map((role) => {
        const font = settings.fonts[role]
        return (
          <div className="set-font-row" key={role}>
            <span className="set-font-label">{ROLE_LABELS[role]}</span>
            <div className="set-font-control">
              <div className="set-font-select">
                <span className="set-font-tag">中</span>
                <select
                  className="set-select"
                  value={font.cjk}
                  onChange={(event) => update(role, { cjk: event.target.value })}
                >
                  {CJK_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              {font.cjk === 'custom' && (
                <input
                  className="set-input"
                  placeholder="中文字体名，例如霞鹜文楷"
                  value={font.customCjk}
                  onChange={(event) => update(role, { customCjk: event.target.value })}
                />
              )}
              <div className="set-font-select">
                <span className="set-font-tag">西</span>
                <select
                  className="set-select"
                  value={font.latin}
                  onChange={(event) => update(role, { latin: event.target.value })}
                >
                  {LATIN_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              {font.latin === 'custom' && (
                <input
                  className="set-input"
                  placeholder="西文字体名，例如 Georgia"
                  value={font.customLatin}
                  onChange={(event) => update(role, { customLatin: event.target.value })}
                />
              )}
            </div>
          </div>
        )
      })}
      <p className="set-hint">同一段里的中文和西文各用各的字体；字体需要已安装在本机。</p>
    </div>
  )
}
