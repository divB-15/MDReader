import { useEffect } from 'react'
import { useStore, fontStackFor } from '../store'
import { platform } from '../lib/platform'

/**
 * Projects the reader settings onto CSS custom properties. Every visual role
 * (body, heading, quote, code, indents) is driven by one variable, so themes
 * and fonts can be changed without any component re-rendering.
 */
export function useTypography(): void {
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.justify = settings.justify ? '1' : '0'
    root.dataset.codeWrap = settings.codeWrap ? '1' : '0'
    root.dataset.codeNumbers = settings.codeNumbers ? '1' : '0'
    root.style.setProperty('--font-body', fontStackFor(settings, 'body'))
    root.style.setProperty('--font-heading', fontStackFor(settings, 'heading'))
    root.style.setProperty('--font-quote', fontStackFor(settings, 'quote'))
    root.style.setProperty('--font-code', fontStackFor(settings, 'code'))
    root.style.setProperty('--reader-size', `${settings.fontSize}px`)
    root.style.setProperty('--reader-leading', String(settings.lineHeight))
    root.style.setProperty('--reader-measure', `${settings.measure}px`)
    root.style.setProperty('--reader-gap', `${settings.paragraphGap}em`)
    root.style.setProperty('--indent-body', `${settings.indent.body}em`)
    root.style.setProperty('--indent-quote', `${settings.indent.quote}em`)
    root.style.setProperty('--indent-list', `${settings.indent.list}em`)
    root.style.setProperty('--indent-code', `${settings.indent.code}em`)
  }, [settings])

  // Window placement is a native property, not a CSS one: push it separately so
  // an unrelated typography change does not re-enter the host.
  const alwaysOnTop = useStore((s) => s.settings.alwaysOnTop)
  useEffect(() => {
    platform.setAlwaysOnTop(alwaysOnTop)
  }, [alwaysOnTop])
}
