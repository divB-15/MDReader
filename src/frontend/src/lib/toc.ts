/**
 * Outline (table of contents) tree helpers.
 *
 * Headings arrive as a flat list with levels; the sidebar needs them nested so
 * a section can be folded away. Pure data in, pure data out — no React, so the
 * nesting rules can be unit tested.
 */
import type { Heading } from './types'

export interface TocNode extends Heading {
  children: TocNode[]
}

/**
 * Nests a flat heading list by level.
 *
 * A level jump (h1 straight to h3) simply nests one step deeper, and a heading
 * that is deeper than its predecessor becomes its child. Ties pop the stack,
 * which is what makes two h2s siblings instead of one burying the other.
 */
export function buildTocTree(headings: readonly Heading[]): TocNode[] {
  const roots: TocNode[] = []
  const stack: TocNode[] = []
  for (const heading of headings) {
    const node: TocNode = { ...heading, children: [] }
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(node)
    else roots.push(node)
    stack.push(node)
  }
  return roots
}

export interface TocBranch {
  id: string
  depth: number
}

/** Every node that has children, i.e. every node with a collapse toggle. */
export function tocBranches(
  nodes: readonly TocNode[],
  depth = 0,
  out: TocBranch[] = [],
): TocBranch[] {
  for (const node of nodes) {
    if (node.children.length) {
      out.push({ id: node.id, depth })
      tocBranches(node.children, depth + 1, out)
    }
  }
  return out
}

/** Everything closed: only the first line of headings remains visible. */
export function collapseAll(nodes: readonly TocNode[]): Set<string> {
  return new Set(tocBranches(nodes).map((branch) => branch.id))
}

/**
 * Top-level headings open, every section below them closed. For a flat outline
 * this is the same set as "expand all", which is the honest answer — there is
 * nothing deeper to hide.
 */
export function expandToFirstLevel(nodes: readonly TocNode[]): Set<string> {
  return new Set(
    tocBranches(nodes)
      .filter((branch) => branch.depth > 0)
      .map((branch) => branch.id),
  )
}

/** Flips one node; the previous set is never mutated (React state safety). */
export function toggleBranch(collapsed: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(collapsed)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
