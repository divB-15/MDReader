const HIT_ATTR = 'data-mr-hit'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function clearSearch(root: HTMLElement): void {
  const marks = root.querySelectorAll<HTMLElement>(`mark[${HIT_ATTR}]`)
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
    parent.normalize()
  }
}

export function applySearch(root: HTMLElement, query: string): number {
  clearSearch(root)
  const needle = query.trim()
  if (!needle) return 0

  let regex: RegExp
  try {
    regex = new RegExp(escapeRegExp(needle), 'giu')
  } catch {
    regex = new RegExp(escapeRegExp(needle), 'gi')
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('.katex-mathml, script, style, .code-ln, mark[data-mr-hit]')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const matches: { node: Text; start: number; end: number }[] = []
  let node = walker.nextNode() as Text | null
  while (node) {
    const text = node.nodeValue || ''
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text))) {
      if (!m[0].length) {
        regex.lastIndex++
        continue
      }
      matches.push({ node, start: m.index, end: m.index + m[0].length })
    }
    node = walker.nextNode() as Text | null
  }

  // Wrap from the end so earlier offsets stay valid while the text node is split.
  let index = matches.length - 1
  for (; index >= 0; index--) {
    const match = matches[index]
    const range = document.createRange()
    range.setStart(match.node, match.start)
    range.setEnd(match.node, match.end)
    const mark = document.createElement('mark')
    mark.className = 'mr-hit'
    mark.setAttribute(HIT_ATTR, String(index + 1))
    try {
      range.surroundContents(mark)
    } catch {
      // Ignore ranges that cross element boundaries.
    }
  }

  // Highlights are painted for every match; scrolling to one is the caller's
  // decision (the reader only jumps when the user asks for the next hit).
  return matches.length
}

export function focusHit(root: HTMLElement, current: number): void {
  const marks = root.querySelectorAll<HTMLElement>(`mark[${HIT_ATTR}]`)
  marks.forEach((mark) => {
    const isCurrent = Number(mark.getAttribute(HIT_ATTR)) === current
    mark.classList.toggle('mr-hit-current', isCurrent)
    if (isCurrent) mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}
