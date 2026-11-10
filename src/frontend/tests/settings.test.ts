import { describe, expect, it } from 'vitest'
import {
  CJK_PRESETS,
  DEFAULT_SETTINGS,
  LATIN_PRESETS,
  fontStackFor,
  normalizeSettings,
} from '../src/store/settings'

describe('settings', () => {
  it('falls back to defaults for missing data', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('upgrades the old single-font setting', () => {
    const migrated = normalizeSettings({ font: 'kai' })
    expect(migrated.fonts.body.cjk).toBe('kaiti')
    expect(migrated.fonts.heading.cjk).toBe(DEFAULT_SETTINGS.fonts.heading.cjk)
  })

  it('upgrades the old one-preset-per-role setting', () => {
    const migrated = normalizeSettings({ fonts: { body: 'lxgw', code: 'consolas' } })
    expect(migrated.fonts.body.cjk).toBe('lxgw')
    expect(migrated.fonts.code.latin).toBe('consolas')
    // Untouched roles keep their defaults.
    expect(migrated.fonts.heading.cjk).toBe(DEFAULT_SETTINGS.fonts.heading.cjk)
  })

  it('upgrades the old boolean indent setting', () => {
    expect(normalizeSettings({ indent: true }).indent.body).toBe(2)
    expect(normalizeSettings({ indent: false }).indent.body).toBe(0)
  })

  it('clamps out-of-range values', () => {
    const settings = normalizeSettings({ fontSize: 99, lineHeight: 5, measure: 20, paragraphGap: 4 })
    expect(settings.fontSize).toBe(25)
    expect(settings.lineHeight).toBe(2.2)
    expect(settings.measure).toBe(560)
    expect(settings.paragraphGap).toBe(1.8)
    expect(normalizeSettings({ measure: 5000 }).measure).toBe(1400)
  })

  it('normalises the window-on-top flag', () => {
    expect(DEFAULT_SETTINGS.alwaysOnTop).toBe(false)
    expect(normalizeSettings({ alwaysOnTop: true }).alwaysOnTop).toBe(true)
    expect(normalizeSettings({ alwaysOnTop: 'yes' }).alwaysOnTop).toBe(true)
    expect(normalizeSettings({}).alwaysOnTop).toBe(false)
  })

  it('keeps per-role indent values', () => {
    const settings = normalizeSettings({ indent: { body: 2, quote: 1, list: 0.5, code: 3 } })
    expect(settings.indent).toEqual({ body: 2, quote: 1, list: 0.5, code: 3 })
  })

  it('resolves latin and CJK families into one stack', () => {
    const stack = fontStackFor(DEFAULT_SETTINGS, 'body')
    expect(stack).toContain('Georgia')
    expect(stack).toContain('Microsoft YaHei')
    // Latin families come first so they win over the CJK face.
    expect(stack.indexOf('Georgia')).toBeLessThan(stack.indexOf('Microsoft YaHei'))
    expect(fontStackFor(DEFAULT_SETTINGS, 'code')).toContain('Cascadia Code')
    expect(fontStackFor(DEFAULT_SETTINGS, 'heading')).toContain('Microsoft YaHei')
  })

  it('defaults every role to Microsoft YaHei', () => {
    for (const role of ['body', 'heading', 'quote', 'code'] as const) {
      expect(DEFAULT_SETTINGS.fonts[role].cjk).toBe('yahei')
    }
  })

  it('moves an untouched SimSun default over to YaHei once', () => {
    const legacy = {
      settingsRev: undefined,
      fonts: {
        body: { latin: 'georgia', cjk: 'simsun', customLatin: '', customCjk: '' },
        quote: { latin: 'georgia', cjk: 'simsun', customLatin: '', customCjk: '' },
      },
    }
    const migrated = normalizeSettings(legacy)
    expect(migrated.fonts.body.cjk).toBe('yahei')
    expect(migrated.fonts.quote.cjk).toBe('yahei')
    expect(migrated.settingsRev).toBe(1)

    // After the upgrade the choice is respected, even if it is SimSun again.
    const explicit = normalizeSettings({
      settingsRev: 1,
      fonts: { body: { latin: 'georgia', cjk: 'simsun', customLatin: '', customCjk: '' } },
    })
    expect(explicit.fonts.body.cjk).toBe('simsun')
  })

  it('supports a custom face per script', () => {
    const custom = normalizeSettings({
      fonts: {
        ...DEFAULT_SETTINGS.fonts,
        body: { latin: 'custom', cjk: 'custom', customLatin: 'Iosevka', customCjk: 'LXGW WenKai' },
      },
    })
    const stack = fontStackFor(custom, 'body')
    expect(stack).toContain('Iosevka')
    expect(stack).toContain('LXGW WenKai')
    expect(stack.indexOf('Iosevka')).toBeLessThan(stack.indexOf('LXGW WenKai'))
  })

  it('keeps code wrapping and line numbers off unless asked', () => {
    expect(DEFAULT_SETTINGS.codeWrap).toBe(false)
    expect(DEFAULT_SETTINGS.codeNumbers).toBe(false)
    expect(normalizeSettings({ codeWrap: true }).codeWrap).toBe(true)
  })

  it('has unique preset ids', () => {
    for (const presets of [LATIN_PRESETS, CJK_PRESETS]) {
      const ids = presets.map((preset) => preset.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
