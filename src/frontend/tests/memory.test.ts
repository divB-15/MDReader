import { beforeEach, describe, expect, it } from 'vitest'
import {
  adoptEntries,
  readMemoryDoc,
  readMemoryImage,
  resetMemoryFolder,
} from '../src/lib/platform/memory'
import { joinPath } from '../src/lib/platform/paths'

// The memory backend is what serves dropped folders and browser folder picks.
// It is exercised with real File objects; object URLs are stubbed because Node
// does not implement them.
beforeEach(() => {
  resetMemoryFolder()
  ;(globalThis.URL as any).createObjectURL = (file: File) => `blob:mock/${file.name}`
  ;(globalThis.URL as any).revokeObjectURL = () => {}
})

describe('memory folder', () => {
  it('lists documents and exposes the first one', async () => {
    const adopted = await adoptEntries(
      [
        { path: 'sample/a.md', file: new File(['# 标题'], 'a.md') },
        { path: 'sample/sub/b.md', file: new File(['note'], 'b.md') },
        { path: 'sample/images/diagram.svg', file: new File(['<svg/>'], 'diagram.svg') },
      ],
      true,
    )
    expect(adopted).not.toBeNull()
    expect(adopted!.listing.root).toBe('sample')
    expect(adopted!.listing.name).toBe('sample')
    expect(adopted!.listing.files.map((file) => file.rel)).toEqual(['a.md', 'sub/b.md'])
    expect(adopted!.first?.path).toBe('sample/a.md')
    expect(adopted!.first?.content).toBe('# 标题')
  })

  it('resolves relative images with ../ and url encoding', async () => {
    await adoptEntries(
      [
        { path: 'sample/示例.md', file: new File(['x'], '示例.md') },
        { path: 'sample/images/diagram.svg', file: new File(['<svg/>'], 'diagram.svg') },
        { path: 'sample/images/pic one.png', file: new File(['png'], 'pic one.png') },
      ],
      false,
    )
    const doc = await readMemoryDoc('sample/示例.md')
    expect(doc?.dir).toBe('sample')

    expect(await readMemoryImage(joinPath('sample', './images/diagram.svg'))).toBe(
      'blob:mock/diagram.svg',
    )
    expect(await readMemoryImage(joinPath('sample/sub', '../images/diagram.svg'))).toBe(
      'blob:mock/diagram.svg',
    )
    expect(await readMemoryImage(joinPath('sample', 'images/pic%20one.png'))).toBe(
      'blob:mock/pic one.png',
    )
    expect(await readMemoryImage(joinPath('sample', 'images/missing.png'))).toBeNull()
  })

  it('falls back to a matching file name for moved documents', async () => {
    await adoptEntries(
      [
        { path: 'sample/a.md', file: new File(['x'], 'a.md') },
        { path: 'sample/images/diagram.svg', file: new File(['<svg/>'], 'diagram.svg') },
      ],
      false,
    )
    expect(await readMemoryImage('elsewhere/images/diagram.svg')).toBe('blob:mock/diagram.svg')
  })

  it('rejects non markdown documents', async () => {
    await adoptEntries(
      [
        { path: 'sample/a.md', file: new File(['x'], 'a.md') },
        { path: 'sample/images/diagram.svg', file: new File(['<svg/>'], 'diagram.svg') },
      ],
      false,
    )
    expect(await readMemoryDoc('sample/images/diagram.svg')).toBeNull()
    expect(await readMemoryDoc('sample/missing.md')).toBeNull()
  })
})
