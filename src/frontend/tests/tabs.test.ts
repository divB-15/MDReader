import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocSource } from '../src/lib/types'

type Store = typeof import('../src/store')['useStore']

// zustand/persist touches localStorage at module init; Vitest runs in node,
// where it does not exist. Install a tiny in-memory stand-in first.
const storage = new Map<string, string>()
let useStore: Store

beforeAll(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
  })
  ;({ useStore } = await import('../src/store'))
})

beforeEach(() => {
  useStore.setState({ docs: [], activeId: null, lastDocPath: '', recent: [], folder: null })
})

const source = (name: string): DocSource => ({
  id: `D:/notes/${name}`,
  path: `D:/notes/${name}`,
  name,
  dir: 'D:/notes',
  content: `# ${name}`,
  provider: 'host',
})

describe('tab lifecycle / the always-on tab bar', () => {
  it('turns the first document into a single tab', () => {
    const doc = useStore.getState().openDoc(source('a.md'))
    const state = useStore.getState()
    expect(state.docs).toHaveLength(1)
    expect(state.activeId).toBe(doc.id)
    expect(state.lastDocPath).toBe('D:/notes/a.md')
  })

  it('adds a second tab without disturbing the first', () => {
    const first = useStore.getState().openDoc(source('a.md'))
    const second = useStore.getState().openDoc(source('b.md'))
    const state = useStore.getState()
    expect(state.docs.map((doc) => doc.id)).toEqual([first.id, second.id])
    expect(state.activeId).toBe(second.id)
  })

  it('keeps the auto-reopen path while at least one tab remains', () => {
    useStore.getState().openDoc(source('a.md'))
    useStore.getState().openDoc(source('b.md'))
    useStore.getState().closeDoc('D:/notes/b.md')
    const state = useStore.getState()
    expect(state.docs).toHaveLength(1)
    expect(state.activeId).toBe('D:/notes/a.md')
    expect(state.lastDocPath).not.toBe('')
  })

  it('forgets the auto-reopen path when the final tab is closed', () => {
    useStore.getState().openDoc(source('a.md'))
    useStore.getState().closeDoc('D:/notes/a.md')
    const state = useStore.getState()
    expect(state.docs).toHaveLength(0)
    expect(state.activeId).toBeNull()
    expect(state.lastDocPath).toBe('')
  })

  it('Ctrl+W (closeActive) ends in the same empty state', () => {
    useStore.getState().openDoc(source('a.md'))
    useStore.getState().closeActive()
    expect(useStore.getState().docs).toHaveLength(0)
    expect(useStore.getState().lastDocPath).toBe('')
  })
})

describe('dragging a tab inside the bar', () => {
  const open = () => {
    for (const name of ['a.md', 'b.md', 'c.md']) useStore.getState().openDoc(source(name))
    return useStore.getState().docs.map((doc) => doc.name)
  }

  it('reorders without switching the active document', () => {
    expect(open()).toEqual(['a.md', 'b.md', 'c.md'])
    useStore.getState().setActive('D:/notes/a.md')
    // Index is expressed in the list without the dragged tab, matching what the
    // pointer arithmetic produces.
    useStore.getState().moveDoc('D:/notes/a.md', 2)
    expect(useStore.getState().docs.map((doc) => doc.name)).toEqual(['b.md', 'c.md', 'a.md'])
    expect(useStore.getState().activeId).toBe('D:/notes/a.md')
  })

  it('moves a tab back to the front', () => {
    open()
    useStore.getState().moveDoc('D:/notes/c.md', 0)
    expect(useStore.getState().docs.map((doc) => doc.name)).toEqual(['c.md', 'a.md', 'b.md'])
  })

  it('is a no-op when the tab lands on its own slot or an unknown id', () => {
    open()
    const before = useStore.getState().docs.map((doc) => doc.id)
    useStore.getState().moveDoc('D:/notes/b.md', 1)
    useStore.getState().moveDoc('D:/notes/missing.md', 0)
    expect(useStore.getState().docs.map((doc) => doc.id)).toEqual(before)
  })

  it('clamps an index past the end instead of dropping the tab', () => {
    open()
    useStore.getState().moveDoc('D:/notes/a.md', 99)
    expect(useStore.getState().docs.map((doc) => doc.name)).toEqual(['b.md', 'c.md', 'a.md'])
  })
})
