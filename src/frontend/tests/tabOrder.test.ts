import { describe, expect, it } from 'vitest'
import { dropIndex, markerIndex, moveItem } from '../src/lib/tabs'

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd']

  it('moves an item to the right', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item to the left', () => {
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('moves an item to the very end', () => {
    expect(moveItem(list, 1, 3)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('never mutates the source list', () => {
    const source = ['a', 'b']
    moveItem(source, 0, 1)
    expect(source).toEqual(['a', 'b'])
  })

  it('ignores an out-of-range source index', () => {
    expect(moveItem(list, 9, 0)).toEqual(list)
  })
})

describe('dropIndex', () => {
  // Four tabs of 100px starting at x=0 → centres at 50/150/250/350.
  const centers = [50, 150, 250, 350]

  it('inserts before the first tab when the cursor is at the far left', () => {
    expect(dropIndex(centers, 5, 3)).toBe(0)
  })

  it('inserts after the last tab when the cursor is at the far right', () => {
    expect(dropIndex(centers, 395, 0)).toBe(3)
  })

  it('reports "no movement" while the cursor stays over the dragged tab', () => {
    expect(dropIndex(centers, 150, 1)).toBe(1)
  })

  it('drops a dragged tab one slot to the right', () => {
    // Dragging #0 over the centre of #1 crosses #1's midpoint → index 1 of the
    // reduced list, i.e. after #1.
    expect(dropIndex(centers, 151, 0)).toBe(1)
  })
})

describe('markerIndex', () => {
  it('hides the line when the drop would not reorder', () => {
    expect(markerIndex(2, 2)).toBeNull()
  })

  it('points at the tab before the drop slot', () => {
    expect(markerIndex(0, 2)).toBe(0)
  })

  it('shifts past the dragged tab', () => {
    expect(markerIndex(2, 0)).toBe(3)
  })

  it('can point past the last tab, meaning "drop at the end"', () => {
    expect(markerIndex(3, 0)).toBe(4)
  })
})
