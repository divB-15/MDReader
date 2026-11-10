import { describe, expect, it } from 'vitest'
import {
  buildTocTree,
  collapseAll,
  expandToFirstLevel,
  tocBranches,
  toggleBranch,
} from '../src/lib/toc'
import type { Heading } from '../src/lib/types'

const heading = (id: string, level: number): Heading => ({
  id,
  level,
  text: id.toUpperCase(),
})

// # A / ## A1 / ### A1a / ## A2 / # B
const flat: Heading[] = [
  heading('a', 1),
  heading('a1', 2),
  heading('a1a', 3),
  heading('a2', 2),
  heading('b', 1),
]

describe('buildTocTree', () => {
  it('nests by level', () => {
    const tree = buildTocTree(flat)
    expect(tree.map((node) => node.id)).toEqual(['a', 'b'])
    expect(tree[0].children.map((node) => node.id)).toEqual(['a1', 'a2'])
    expect(tree[0].children[0].children.map((node) => node.id)).toEqual(['a1a'])
  })

  it('keeps a level jump as a single nesting step instead of inventing parents', () => {
    const tree = buildTocTree([heading('x', 1), heading('y', 4)])
    expect(tree).toHaveLength(1)
    expect(tree[0].children.map((node) => node.id)).toEqual(['y'])
  })

  it('starts a new root when a later heading is shallower', () => {
    const tree = buildTocTree([heading('deep', 3), heading('top', 1), heading('next', 2)])
    expect(tree.map((node) => node.id)).toEqual(['deep', 'top'])
    expect(tree[1].children.map((node) => node.id)).toEqual(['next'])
  })

  it('returns no roots for an empty outline', () => {
    expect(buildTocTree([])).toEqual([])
  })

  it('does not mutate the heading objects', () => {
    const source = [heading('a', 1)]
    buildTocTree(source)
    expect(source[0]).not.toHaveProperty('children')
  })
})

describe('collapse presets', () => {
  const tree = buildTocTree(flat)

  it('lists only nodes that actually have children', () => {
    expect(tocBranches(tree).map((branch) => branch.id)).toEqual(['a', 'a1'])
  })

  it('collapse-all closes every branch', () => {
    const closed = collapseAll(tree)
    expect([...closed].sort()).toEqual(['a', 'a1'])
  })

  it('expand-to-first-level leaves only the roots open', () => {
    const closed = expandToFirstLevel(tree)
    expect([...closed]).toEqual(['a1'])
  })

  it('expand-to-first-level equals expand-all for a flat outline', () => {
    const flatTree = buildTocTree([heading('a', 2), heading('b', 2)])
    expect(expandToFirstLevel(flatTree).size).toBe(0)
    expect(collapseAll(flatTree).size).toBe(0)
  })
})

describe('toggleBranch', () => {
  it('flips one id without touching the input set', () => {
    const before = new Set(['a'])
    const after = toggleBranch(before, 'b')
    expect([...after].sort()).toEqual(['a', 'b'])
    expect([...before]).toEqual(['a'])
    expect(toggleBranch(after, 'a').has('a')).toBe(false)
  })
})
