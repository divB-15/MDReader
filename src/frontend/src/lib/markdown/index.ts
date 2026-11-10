import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Heading } from '../types'
import { headingText, slugify } from './headings'
import { rehypeCodeLines } from './codeLines'
import { normalizeMathDelimiters } from './mathDelimiters'
import { markdownSanitizeSchema, rehypeLocalImages, rehypeSafeHtml, rehypeSanitize } from './sanitize'

export { countReadingStats } from './stats'

export interface RenderResult {
  html: string
  headings: Heading[]
}

export async function renderMarkdown(source: string): Promise<RenderResult> {
  const headings: Heading[] = []
  const used = new Set<string>()
  let anonymous = 0

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkMath)
    .use(() => (tree: any) => {
      visit(tree, 'heading', (node: any) => {
        const text = headingText(node)
        let id = slugify(text)
        if (used.has(id)) {
          let suffix = 2
          while (used.has(`${id}-${suffix}`)) suffix++
          id = `${id}-${suffix}`
        }
        if (!text) id = `section-${++anonymous}`
        used.add(id)
        node.data = node.data || {}
        node.data.hProperties = { ...(node.data.hProperties || {}), id }
        headings.push({ id, text: text || `第 ${anonymous} 节`, level: node.depth })
      })
    })
    .use(remarkRehype, { allowDangerousHtml: true, clobberPrefix: '' })
    .use(rehypeRaw)
    .use(rehypeSafeHtml)
    .use(rehypeSanitize, markdownSanitizeSchema)
    // KaTeX has to run before the code pipeline: display math is exported by
    // remark-math as `<pre><code class="language-math">`, and the line splitter
    // would otherwise inject its numbers into the formula source.
    .use(rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' } as any)
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
    .use(rehypeCodeLines)
    .use(rehypeLocalImages)
    .use(rehypeStringify, { allowDangerousHtml: true })

  // `\(...\)` / `\[...\]` have to become dollars *before* the parser runs:
  // CommonMark swallows the backslash of an escaped punctuation character, so
  // by the tree phase the delimiters are gone. See mathDelimiters.ts.
  const file = await processor.process(normalizeMathDelimiters(source))
  return { html: String(file), headings }
}
