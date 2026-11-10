export type ThemeName = 'paper' | 'sepia' | 'night'
export type FontRole = 'body' | 'heading' | 'quote' | 'code'

export interface FontPreset {
  id: string
  label: string
  /** Families in priority order; empty means "fall through to the next list". */
  families: string[]
}

/**
 * Latin and CJK faces are chosen separately for every role: a Chinese document
 * routinely mixes both inside one paragraph, and one family rarely covers both
 * scripts well. The stack is built latin-first so Latin glyphs win, while CJK
 * characters fall through to the CJK family (the browser picks per glyph).
 */
export const LATIN_PRESETS: FontPreset[] = [
  { id: 'auto', label: '跟随系统', families: ['system-ui', 'Segoe UI'] },
  { id: 'segoe', label: 'Segoe UI', families: ['Segoe UI'] },
  { id: 'georgia', label: 'Georgia', families: ['Georgia'] },
  { id: 'times', label: 'Times New Roman', families: ['Times New Roman'] },
  { id: 'palatino', label: 'Palatino', families: ['Palatino Linotype', 'Book Antiqua'] },
  { id: 'garamond', label: 'Garamond', families: ['Garamond', 'EB Garamond'] },
  { id: 'consolas', label: 'Consolas', families: ['Consolas'] },
  { id: 'cascadia', label: 'Cascadia Code', families: ['Cascadia Code', 'Cascadia Mono'] },
  { id: 'courier', label: 'Courier New', families: ['Courier New'] },
  { id: 'custom', label: '自定义…', families: [] },
]

export const CJK_PRESETS: FontPreset[] = [
  { id: 'auto', label: '跟随系统', families: ['Microsoft YaHei', 'PingFang SC', 'Noto Sans SC'] },
  { id: 'yahei', label: '微软雅黑', families: ['Microsoft YaHei', 'PingFang SC', 'Noto Sans SC'] },
  { id: 'simsun', label: '宋体', families: ['SimSun', 'Songti SC', 'Noto Serif CJK SC'] },
  { id: 'simhei', label: '黑体', families: ['SimHei', 'Heiti SC', 'Noto Sans CJK SC'] },
  { id: 'kaiti', label: '楷体', families: ['KaiTi', 'STKaiti', 'Kaiti SC', 'BiauKai'] },
  { id: 'fangsong', label: '仿宋', families: ['FangSong', 'STFangsong', 'FangSong_GB2312'] },
  { id: 'dengxian', label: '等线', families: ['DengXian', 'Microsoft YaHei'] },
  { id: 'source-serif', label: '思源宋体', families: ['Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC'] },
  { id: 'source-sans', label: '思源黑体', families: ['Source Han Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei'] },
  { id: 'lxgw', label: '霞鹜文楷', families: ['LXGW WenKai', 'LXGW WenKai GB', 'KaiTi'] },
  { id: 'custom', label: '自定义…', families: [] },
]

export const ROLE_LABELS: Record<FontRole, string> = {
  body: '正文',
  heading: '标题',
  quote: '引用',
  code: '代码',
}

export const ROLE_FALLBACK: Record<FontRole, string> = {
  body: 'serif',
  heading: 'sans-serif',
  quote: 'serif',
  code: 'monospace',
}

export interface RoleFont {
  /** Latin preset id (see LATIN_PRESETS). */
  latin: string
  /** CJK preset id (see CJK_PRESETS). */
  cjk: string
  customLatin: string
  customCjk: string
}

export interface IndentSettings {
  /** First-line indent of body paragraphs, in em. */
  body: number
  /** First-line indent of paragraphs inside blockquotes. */
  quote: number
  /** First-line indent of list item text. */
  list: number
  /** Extra left inset of code blocks, in em. */
  code: number
}

export interface Settings {
  theme: ThemeName
  fontSize: number
  lineHeight: number
  measure: number
  paragraphGap: number
  justify: boolean
  sidebar: boolean
  focus: boolean
  fonts: Record<FontRole, RoleFont>
  indent: IndentSettings
  /** Long code lines: wrap instead of scrolling horizontally. */
  codeWrap: boolean
  /** Show a line-number gutter on code blocks. */
  codeNumbers: boolean
  /** Keep the window above other applications (desktop shell only). */
  alwaysOnTop: boolean
  /**
   * Bumped whenever a default changes in a way that must also reach existing
   * installs. Persisted next to the values so the upgrade only runs once.
   */
  settingsRev: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'paper',
  fontSize: 17,
  lineHeight: 1.85,
  measure: 720,
  paragraphGap: 0.6,
  justify: false,
  sidebar: true,
  focus: false,
  fonts: {
    body: { latin: 'georgia', cjk: 'yahei', customLatin: '', customCjk: '' },
    heading: { latin: 'segoe', cjk: 'yahei', customLatin: '', customCjk: '' },
    quote: { latin: 'georgia', cjk: 'yahei', customLatin: '', customCjk: '' },
    code: { latin: 'cascadia', cjk: 'yahei', customLatin: '', customCjk: '' },
  },
  indent: {
    body: 2,
    quote: 0,
    list: 0,
    code: 0,
  },
  codeWrap: false,
  codeNumbers: false,
  alwaysOnTop: false,
  settingsRev: 1,
}

function familiesFor(presetId: string, presets: FontPreset[], custom: string): string[] {
  if (presetId === 'custom') {
    const name = custom.trim()
    return name ? [name] : []
  }
  return presets.find((preset) => preset.id === presetId)?.families || []
}

export function fontStackFor(settings: Settings, role: FontRole): string {
  const font = settings.fonts[role] || DEFAULT_SETTINGS.fonts[role]
  const latin = familiesFor(font.latin || 'auto', LATIN_PRESETS, font.customLatin || '')
  const cjk = familiesFor(font.cjk || 'auto', CJK_PRESETS, font.customCjk || '')
  const fallback = ROLE_FALLBACK[role]
  const stack = [...latin, ...cjk, fallback]
  return stack.join(', ')
}

const CJK_PRESET_IDS = new Set(CJK_PRESETS.map((preset) => preset.id))
const LATIN_PRESET_IDS = new Set(LATIN_PRESETS.map((preset) => preset.id))

/**
 * Merge persisted settings with the current defaults. Older builds stored one
 * preset per role in `fonts`, a single `font` key before that, and a boolean
 * `indent`; all of those are upgraded in place so an existing install keeps its
 * look.
 */
export function normalizeSettings(raw: unknown): Settings {
  const value = (raw || {}) as Record<string, any>
  const legacyFontRole: Record<string, string> = { serif: 'simsun', sans: 'yahei', kai: 'kaiti' }

  const fonts = { ...DEFAULT_SETTINGS.fonts }
  const stored = value.fonts
  if (stored && typeof stored === 'object') {
    for (const role of Object.keys(DEFAULT_SETTINGS.fonts) as FontRole[]) {
      const entry = stored[role]
      const target = { ...DEFAULT_SETTINGS.fonts[role] }
      if (typeof entry === 'string') {
        // Before fonts were split per script the dropdown held both lists.
        if (CJK_PRESET_IDS.has(entry)) target.cjk = entry
        else if (LATIN_PRESET_IDS.has(entry)) target.latin = entry
        else target.cjk = entry
        if (entry === 'custom') target.cjk = 'custom'
      } else if (entry && typeof entry === 'object') {
        if (typeof entry.latin === 'string') target.latin = entry.latin
        if (typeof entry.cjk === 'string') target.cjk = entry.cjk
        if (typeof entry.customLatin === 'string') target.customLatin = entry.customLatin
        if (typeof entry.customCjk === 'string') target.customCjk = entry.customCjk
      }
      // Very old builds carried one global custom font name.
      if (!target.customCjk && typeof value.customFonts?.[role] === 'string') {
        target.customCjk = value.customFonts[role]
      }
      fonts[role] = target
    }
  } else if (typeof value.font === 'string' && legacyFontRole[value.font]) {
    fonts.body = { ...fonts.body, cjk: legacyFontRole[value.font] }
  }

  // Revision 1: the default CJK face moved from SimSun to Microsoft YaHei.
  // A stored 'simsun' still means "the old default" for anyone who never
  // touched the font section, so it is rewritten once here. Choosing 宋体
  // after this point stores settingsRev = 1 and is therefore left alone.
  const storedRev = typeof value.settingsRev === 'number' ? value.settingsRev : 0
  if (storedRev < 1) {
    for (const role of Object.keys(fonts) as FontRole[]) {
      if (fonts[role].cjk === 'simsun') fonts[role].cjk = 'yahei'
    }
  }

  const indent = { ...DEFAULT_SETTINGS.indent, ...(value.indent && typeof value.indent === 'object' ? value.indent : {}) }
  if (!value.indent || typeof value.indent === 'boolean') {
    indent.body = value.indent === true ? 2 : value.indent === false ? 0 : DEFAULT_SETTINGS.indent.body
  }

  const number = (input: unknown, fallback: number, min: number, max: number): number => {
    const parsed = typeof input === 'number' ? input : Number(input)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, parsed))
  }

  return {
    theme: ['paper', 'sepia', 'night'].includes(value.theme) ? value.theme : DEFAULT_SETTINGS.theme,
    fontSize: number(value.fontSize, DEFAULT_SETTINGS.fontSize, 14, 25),
    lineHeight: number(value.lineHeight, DEFAULT_SETTINGS.lineHeight, 1.4, 2.2),
    measure: number(value.measure, DEFAULT_SETTINGS.measure, 560, 1400),
    paragraphGap: number(value.paragraphGap, DEFAULT_SETTINGS.paragraphGap, 0.3, 1.8),
    justify: !!value.justify,
    sidebar: value.sidebar !== false,
    focus: !!value.focus,
    fonts,
    indent: {
      body: number(indent.body, DEFAULT_SETTINGS.indent.body, 0, 4),
      quote: number(indent.quote, DEFAULT_SETTINGS.indent.quote, 0, 4),
      list: number(indent.list, DEFAULT_SETTINGS.indent.list, 0, 4),
      code: number(indent.code, DEFAULT_SETTINGS.indent.code, 0, 4),
    },
    codeWrap: !!value.codeWrap,
    codeNumbers: !!value.codeNumbers,
    alwaysOnTop: !!value.alwaysOnTop,
    settingsRev: DEFAULT_SETTINGS.settingsRev,
  }
}
