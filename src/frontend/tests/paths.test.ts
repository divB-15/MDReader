import { describe, expect, it } from 'vitest'
import { baseName, dirOf, isAbsolutePath, joinPath, normalizeSrc } from '../src/lib/platform/paths'

describe('path helpers', () => {
  it('joins relative sources against the document directory', () => {
    expect(joinPath('notes', './images/x.png')).toBe('notes/images/x.png')
    expect(joinPath('notes/sub', '../images/x.png')).toBe('notes/images/x.png')
    expect(joinPath('', 'images/x.png')).toBe('images/x.png')
  })

  it('keeps absolute paths untouched', () => {
    expect(joinPath('notes', 'C:\\pics\\x.png')).toBe('C:/pics/x.png')
    expect(joinPath('notes', '/var/pics/x.png')).toBe('/var/pics/x.png')
    expect(isAbsolutePath('/var/pics/x.png')).toBe(true)
    expect(isAbsolutePath('notes/x.png')).toBe(false)
  })

  it('normalises url encoded and file sources', () => {
    expect(normalizeSrc('pic%20one.png')).toBe('pic one.png')
    expect(normalizeSrc('file:///C:/notes/a.png')).toBe('C:/notes/a.png')
    expect(normalizeSrc('a.png#fragment')).toBe('a.png')
    expect(normalizeSrc('a.png?cache=1')).toBe('a.png')
  })

  it('splits names and directories', () => {
    expect(dirOf('notes/sub/a.md')).toBe('notes/sub')
    expect(dirOf('a.md')).toBe('')
    expect(baseName('notes/sub/a.md')).toBe('a.md')
  })
})
