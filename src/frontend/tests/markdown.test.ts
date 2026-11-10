import { describe, expect, it } from 'vitest'
import { renderMarkdown, countReadingStats } from '../src/lib/markdown'
import { normalizeMathDelimiters } from '../src/lib/markdown/mathDelimiters'

describe('markdown rendering', () => {
  it('collects headings and deduplicates ids', async () => {
    const result = await renderMarkdown('# 标题\n\n## 标题\n\n### 英文 Heading\n')
    expect(result.headings.map((heading) => heading.id)).toEqual(['标题', '标题-2', '英文-heading'])
    expect(result.headings.map((heading) => heading.level)).toEqual([1, 2, 3])
    expect(result.html).toContain('id="标题"')
    expect(result.html).toContain('id="标题-2"')
  })

  it('renders GFM tables, task lists and footnotes', async () => {
    const result = await renderMarkdown(
      '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- [x] 完成\n- [ ] 未完成\n\n脚注[^1]\n\n[^1]: 内容\n',
    )
    expect(result.html).toContain('<table>')
    expect(result.html).toContain('type="checkbox"')
    expect(result.html).toContain('checked')
    expect(result.html).toContain('class="footnotes"')
  })

  it('does not clobber footnote ids', async () => {
    const result = await renderMarkdown('脚注[^1]\n\n[^1]: 内容\n')
    expect(result.html).toContain('href="#fn-1"')
    expect(result.html).toContain('id="fnref-1"')
    expect(result.html).not.toContain('user-content-')
  })

  it('renders KaTeX for inline and block maths', async () => {
    const result = await renderMarkdown('公式 $x^2$ 与\n\n$$\n\\int_0^1 x\\,dx\n$$\n')
    expect(result.html).toContain('class="katex"')
    expect(result.html).toContain('katex-display')
  })

  it('keeps data images and parks relative images for the platform layer', async () => {
    const result = await renderMarkdown(
      '![内嵌](data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E)\n\n![相对](./images/a.png)\n',
    )
    expect(result.html).toContain('src="data:image/svg+xml')
    expect(result.html).toContain('data-src="./images/a.png"')
    expect(result.html).not.toMatch(/<img[^>]*\ssrc="\.\/images/)
  })

  it('strips dangerous html but keeps the allowed subset', async () => {
    const result = await renderMarkdown(
      [
        '<script>alert(1)</script>',
        '<iframe src="https://example.com"></iframe>',
        '<style>body{display:none}</style>',
        '<a href="javascript:alert(1)">链接</a>',
        '<img src="x.png" style="width:200px;position:fixed" onerror="alert(1)">',
        '<details open><summary>展开</summary>',
        '',
        '被 <mark>高亮</mark> 的 <kbd>Ctrl</kbd>。',
        '',
        '</details>',
      ].join('\n'),
    )
    expect(result.html).not.toContain('<script')
    expect(result.html).not.toContain('<iframe')
    expect(result.html).not.toContain('<style')
    expect(result.html).not.toContain('javascript:')
    expect(result.html).not.toContain('onerror')
    expect(result.html).not.toContain('position:fixed')
    expect(result.html).toContain('width="200px"')
    expect(result.html).toContain('<details')
    expect(result.html).toContain('<mark>高亮</mark>')
  })

  it('removes paragraphs left empty by stripped html', async () => {
    const result = await renderMarkdown('<script>alert(1)</script>\n\n正常段落。\n')
    expect(result.html).not.toContain('<p></p>')
    expect(result.html).toContain('正常段落。')
  })

  it('keeps inline maths in the outline text', async () => {
    const result = await renderMarkdown('## 公式 $x^2$ 与 `code`\n')
    expect(result.headings[0].text).toBe('公式 x^2 与 code')
    expect(result.headings[0].id).toBe('公式-x2-与-code')
  })

  it('drops file: links but keeps the text', async () => {
    const result = await renderMarkdown('[点我](file:///C:/Windows/System32/calc.exe)\n')
    expect(result.html).toContain('点我')
    expect(result.html).not.toContain('file:///')
  })

  it('anonymises remote images', async () => {
    const result = await renderMarkdown('![t](https://example.com/x.png)\n')
    expect(result.html).toContain('src="https://example.com/x.png"')
    expect(result.html).toContain('referrerpolicy="no-referrer"')
  })

  it('splits code blocks into numbered lines', async () => {
    const result = await renderMarkdown('```js\nconst a = 1\n\nconst b = 2\n```\n')
    expect(result.html.match(/class="code-line"/g)?.length).toBe(3)
    expect(result.html.match(/class="code-ln"/g)?.length).toBe(3)
    expect(result.html).toContain('>3</span>')
    // Highlighting inside a line survives the split.
    expect(result.html).toContain('hljs-keyword')
  })

  it('splits a syntax token that spans several lines', async () => {
    const result = await renderMarkdown('```js\n/* one\n   two */\nconst a = 1\n```\n')
    const lines = result.html.match(/class="code-line"/g) || []
    expect(lines.length).toBe(3)
    expect(result.html).toContain('two')
  })

  it('counts CJK and latin text for the status bar', () => {
    expect(countReadingStats('你好世界').words).toBe(4)
    expect(countReadingStats('你好世界 hello world').words).toBe(6)
    expect(countReadingStats('').minutes).toBe(1)
    expect(countReadingStats('```\nconst x = 1\n```\n正文').words).toBe(2)
  })

  it('never numbers a display formula', async () => {
    // remark-math exports display math as <pre><code class="language-math">, so
    // the line splitter used to splice its gutter numbers into the LaTeX.
    const result = await renderMarkdown('$$\na^2+b^2=c^2\n$$\n\n$$\n\\sum_{n=1}^{\\infty}\\frac{1}{n^2}\n$$\n')
    expect(result.html).not.toContain('code-line')
    expect(result.html).not.toContain('code-ln')
    expect(result.html).toContain('>a^2+b^2=c^2</annotation>')
    expect(result.html).toContain('\\sum_{n=1}^{\\infty}')
  })

  it('labels a fenced block with its language', async () => {
    const result = await renderMarkdown('```python\nprint(1)\n```\n\n```ts\nlet a = 1\n```\n')
    expect(result.html).toContain('data-lang="Python"')
    expect(result.html).toContain('data-lang="TypeScript"')
    expect(result.html).toContain('class="code-wrap"')
  })

  it('shows the raw fence info for unknown languages', async () => {
    expect((await renderMarkdown('```brainfuck\nx = 1\n```\n')).html).toContain('data-lang="Brainfuck"')
    expect((await renderMarkdown('```idl\nx = 1\n```\n')).html).toContain('data-lang="IDL"')
  })

  it('leaves an unlabelled fence without a header strip', async () => {
    const result = await renderMarkdown('```\nplain\n```\n')
    expect(result.html).not.toContain('code-wrap')
    expect(result.html).toContain('code-line')
  })
})

describe('bracket math delimiters', () => {
  it('renders \\(...\\) as inline maths', async () => {
    const result = await renderMarkdown('行内 \\(x^2 + y^2\\) 结束。\n')
    expect(result.html).toContain('class="katex"')
    expect(result.html).toContain('x^2 + y^2</annotation>')
    expect(result.html).not.toContain('\\(')
  })

  it('renders a multi-line \\[...\\] block as display maths', async () => {
    const result = await renderMarkdown('\\[\n\\int_0^1 x\\,dx = \\frac{1}{2}\n\\]\n')
    expect(result.html).toContain('katex-display')
    // Commands that markdown would otherwise eat must survive intact.
    expect(result.html).toContain('\\int_0^1 x\\,dx = \\frac{1}{2}</annotation>')
  })

  it('accepts a one-line \\[...\\] standing alone', async () => {
    const result = await renderMarkdown('\\[ a^2+b^2=c^2 \\]\n')
    expect(result.html).toContain('katex-display')
    expect(result.html).toContain('a^2+b^2=c^2</annotation>')
  })

  it('falls back to inline maths for \\[...\\] inside a sentence', async () => {
    const result = await renderMarkdown('所以 \\[x=1\\] 成立。\n')
    expect(result.html).toContain('class="katex"')
    expect(result.html).not.toContain('katex-display')
    expect(result.html).toContain('所以 ')
  })

  it('never rewrites fenced code', async () => {
    const result = await renderMarkdown('```tex\n\\(x\\)\n```\n\n~~~\n\\[y\\]\n~~~\n')
    expect(result.html).not.toContain('katex')
    expect(result.html).toContain('\\(x\\)')
    expect(result.html).toContain('\\[y\\]')
  })

  it('never rewrites inline code or existing dollar maths', async () => {
    const result = await renderMarkdown('`\\(not math\\)` 与 $a+b$ 与 \\(c\\)\n')
    expect(result.html).toContain('\\(not math\\)')
    expect(result.html.match(/class="katex"/g)).toHaveLength(2)
    expect(result.html).toContain('c</annotation>')
    // A $...$ region is copied through untouched, delimiters included.
    expect(normalizeMathDelimiters('$a\\(b$ 与 \\(c\\)')).toBe('$a\\(b$ 与 $c$')
  })

  it('keeps a double backslash literal', async () => {
    const result = await renderMarkdown('转义 \\\\(y\\\\) 结束\n')
    expect(result.html).not.toContain('katex')
    expect(result.html).toContain('\\(y\\)')
  })

  it('leaves an unclosed opener as typed', async () => {
    // The backslash written to the tree is still a markdown escape, so the text
    // shows `(x` — same as before this feature, never a broken formula.
    const result = await renderMarkdown('开头 \\(x 没有闭合\n')
    expect(result.html).not.toContain('katex')
    expect(result.html).toContain('开头 (x 没有闭合')
  })

  it('puts the formula into the outline text', async () => {
    const result = await renderMarkdown('## 能量 \\(E=mc^2\\)\n')
    expect(result.headings[0].text).toBe('能量 E=mc^2')
  })

  it('does not number display maths converted from brackets', async () => {
    const result = await renderMarkdown('\\[\n\\sum_{n=1}^{\\infty}\\frac{1}{n^2}\n\\]\n')
    expect(result.html).not.toContain('code-line')
    expect(result.html).not.toContain('code-ln')
  })

  it('normalises only what is outside code', () => {
    expect(normalizeMathDelimiters('a \\(x\\) b')).toBe('a $x$ b')
    expect(normalizeMathDelimiters('\\[\nx\n\\]')).toBe('$$\nx\n$$')
    expect(normalizeMathDelimiters('```\n\\(x\\)\n```')).toBe('```\n\\(x\\)\n```')
    expect(normalizeMathDelimiters('`\\(x\\)`')).toBe('`\\(x\\)`')
    // Cheap early-out: a document without bracket delimiters is returned as is.
    const plain = '# 标题\n\n正文 $a$ 与 $$b$$。\n'
    expect(normalizeMathDelimiters(plain)).toBe(plain)
  })
})
