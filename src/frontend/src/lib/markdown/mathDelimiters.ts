/**
 * Rewrites `\(...\)` and `\[...\]` into the `$...$` / `$$...$$` form that
 * remark-math understands.
 *
 * Why this runs on the raw text instead of inside a remark plugin: CommonMark
 * treats a backslash before ASCII punctuation as an escape, so `\(` is consumed
 * by the parser and reaches the tree as a bare `(`. By the time any plugin sees
 * a text node the backslashes — and every `\,` / `\{` inside the formula — are
 * already gone. The original bytes survive only before `remarkParse` runs.
 *
 * Regions that must not be touched: fenced code (``` / ~~~), inline code spans,
 * and formulas already delimited with dollars.
 *
 * Known limitations, all deliberate:
 * - Four-space indented code blocks and raw HTML blocks are not recognised, so
 *   a `\(` inside them is still rewritten. Detecting those means reimplementing
 *   half of the CommonMark block rules for a case that almost never matters.
 * - `\(...\)` must close on the same line; a formula split across two lines of
 *   a paragraph is left as typed.
 * - A formula that ends right before a digit (`\(x\)2`) becomes `$x$2`, which
 *   remark-math refuses to close. Inline math followed directly by a digit is
 *   vanishingly rare in prose (CJK text uses full-width punctuation).
 */

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/
const FENCE_BODY = /^ {0,3}(`+|~+)[ \t]*$/

function isFenceClose(line: string, marker: string): boolean {
  const match = FENCE_BODY.exec(line)
  return !!match && match[1][0] === marker[0] && match[1].length >= marker.length
}

/**
 * Index just past the backtick run of exactly `length` starting at `from`,
 * or -1 when the code span is never closed.
 */
function findClosingTickRun(line: string, from: number, length: number): number {
  let i = from
  while (i < line.length) {
    if (line[i] !== '`') {
      i++
      continue
    }
    let run = 0
    while (line[i + run] === '`') run++
    if (run === length) return i + run
    i += run
  }
  return -1
}

/** Wraps a formula body in single dollars, or bails when it cannot round-trip. */
function wrapInline(body: string): string | null {
  const inner = body.trim()
  if (!inner) return null
  // A dollar inside would terminate the formula early; a nested opener means we
  // mis-detected a delimiter pair.
  if (inner.includes('$')) return null
  if (inner.includes('\\(') || inner.includes('\\[')) return null
  return `$${inner}$`
}

/**
 * Converts the delimiters that sit inside one line of prose. Code spans and
 * existing `$...$` regions are copied through so their content stays verbatim.
 */
export function normalizeInlineMath(line: string): string {
  let out = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]

    if (ch === '`') {
      let run = 0
      while (line[i + run] === '`') run++
      const end = findClosingTickRun(line, i + run, run)
      if (end === -1) {
        out += line.slice(i, i + run)
        i += run
      } else {
        out += line.slice(i, end)
        i = end
      }
      continue
    }

    if (ch === '\\') {
      const next = line[i + 1]
      if (next === '\\') {
        // `\\(` is an escaped backslash: the author wants a literal `\(`.
        out += '\\\\'
        i += 2
        continue
      }
      if (next === '(' || next === '[') {
        const close = next === '(' ? '\\)' : '\\]'
        const end = line.indexOf(close, i + 2)
        const wrapped = end === -1 ? null : wrapInline(line.slice(i + 2, end))
        if (wrapped) {
          out += wrapped
          i = end + 2
          continue
        }
        // Unclosed, empty or not convertible: keep what the author typed.
        out += line.slice(i, i + 2)
        i += 2
        continue
      }
      out += ch
      i++
      continue
    }

    if (ch === '$') {
      let run = 0
      while (line[i + run] === '$') run++
      const closer = '$'.repeat(run)
      const end = line.indexOf(closer, i + run)
      if (end === -1) {
        out += closer
        i += run
      } else {
        out += line.slice(i, end + run)
        i = end + run
      }
      continue
    }

    out += ch
    i++
  }
  return out
}

interface BlockRewrite {
  lines: string[]
  next: number
}

/**
 * Matches a `\[` that opens a display formula: either alone on its line or
 * wrapping the whole line (`\[ x = 1 \]`), and finds where it ends.
 */
function readDisplayMath(lines: string[], start: number): BlockRewrite | null {
  const opener = lines[start]
  const trimmed = opener.trim()
  if (!trimmed.startsWith('\\[')) return null

  const pad = /^[ \t]*/.exec(opener)![0]
  // More than three columns of indentation would turn the emitted `$$` into an
  // indented code block, so only keep the prefix that markdown still reads as
  // flow content (list items use two or three spaces).
  const indent = pad.length <= 3 ? pad : ''
  const rest = trimmed.slice(2)

  if (rest.endsWith('\\]')) {
    const body = rest.slice(0, -2).trim()
    if (!body || body.includes('$') || body.includes('\n')) return null
    return { lines: [`${indent}$$`, body, `${indent}$$`], next: start + 1 }
  }

  if (rest.trim()) return null // `\[` with trailing text is not a block opener

  // Multi-line form: the closing `\]` has to own its line.
  const body: string[] = []
  for (let i = start + 1; i < lines.length && i < start + 500; i++) {
    const line = lines[i]
    if (line.trim() === '\\]') {
      if (!body.length) return null
      const text = body.join('\n')
      if (text.includes('$$')) return null
      return { lines: [`${indent}$$`, ...body, `${indent}$$`], next: i + 1 }
    }
    if (FENCE_OPEN.test(line)) return null // a stray opener: give up, leave as typed
    body.push(line)
  }
  return null
}

/**
 * Entry point: returns the source with `\(...\)` / `\[...\]` rewritten so
 * remark-math can parse it. Must run before `remarkParse`.
 */
export function normalizeMathDelimiters(source: string): string {
  if (!source.includes('\\(') && !source.includes('\\[')) return source

  const lines = source.split(/\r?\n/)
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const fence = FENCE_OPEN.exec(lines[i])
    if (fence) {
      // Fenced code: copy verbatim until the matching closing fence.
      out.push(lines[i++])
      while (i < lines.length) {
        const line = lines[i++]
        out.push(line)
        if (isFenceClose(line, fence[1])) break
      }
      continue
    }

    const block = readDisplayMath(lines, i)
    if (block) {
      out.push(...block.lines)
      i = block.next
      continue
    }

    out.push(normalizeInlineMath(lines[i]))
    i++
  }

  return out.join('\n')
}
