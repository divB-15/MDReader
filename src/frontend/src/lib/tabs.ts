/**
 * Tab-order helpers for dragging a tab inside the tab bar.
 *
 * Kept free of React and of the platform bridge so the arithmetic can be unit
 * tested: getting the insertion index wrong is invisible until the user drops
 * the tab and sees it land one slot off.
 */

/** Returns a copy of `list` with the item at `from` moved to index `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  if (from < 0 || from >= next.length) return next
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}

/**
 * Insertion index for a dragged tab, derived from the horizontal cursor
 * position.
 *
 * `centers` holds the mid-x of every tab in display order. Counting only the
 * tabs whose centre sits left of the cursor (and never the dragged one) yields
 * an index into the list *without* the dragged tab — exactly the `to` argument
 * `moveItem` expects.
 */
export function dropIndex(
  centers: readonly number[],
  x: number,
  dragged: number,
): number {
  let index = 0
  for (let i = 0; i < centers.length; i++) {
    if (i === dragged) continue
    if (centers[i] < x) index += 1
  }
  return index
}

/**
 * The tab that should draw the drop line *before* itself, or `null` when the
 * drop would not change the order.
 *
 * `dropAt` is an index in the list without the dragged tab, so it has to be
 * shifted back into display coordinates. The result may equal the tab count,
 * which means "after the last tab".
 */
export function markerIndex(dropAt: number, dragged: number): number | null {
  if (dropAt === dragged) return null
  return dropAt < dragged ? dropAt : dropAt + 1
}
