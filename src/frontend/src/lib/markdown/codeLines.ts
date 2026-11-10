import { visit } from 'unist-util-visit'

/**
 * Turns a highlighted `<pre><code>` into one `<span class="code-line">` per
 * source line, each prefixed by its own number cell, and labels the block with
 * the language from its fence info string.
 *
 * Line numbers are emitted unconditionally and hidden by CSS: toggling the
 * gutter in the settings is then a pure style change, no re-render needed. The
 * numbers live inside the scroll container but stick to its left edge, so they
 * stay put when a long line is scrolled sideways.
 *
 * Display math arrives here as `<pre><code class="language-math">` (that is how
 * remark-math exports it before KaTeX runs), so it has to be left untouched:
 * numbering it would splice digits into the LaTeX source.
 */

const LANGUAGE_LABELS: Record<string, string> = {
  arduino: 'Arduino',
  bash: 'Bash',
  bat: 'Batch',
  batch: 'Batch',
  c: 'C',
  'c#': 'C#',
  'c++': 'C++',
  clj: 'Clojure',
  clojure: 'Clojure',
  cmake: 'CMake',
  coffee: 'CoffeeScript',
  cpp: 'C++',
  cs: 'C#',
  csharp: 'C#',
  css: 'CSS',
  d: 'D',
  dart: 'Dart',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  elixir: 'Elixir',
  erl: 'Erlang',
  erlang: 'Erlang',
  fs: 'F#',
  fsharp: 'F#',
  go: 'Go',
  golang: 'Go',
  gradle: 'Gradle',
  graphql: 'GraphQL',
  groovy: 'Groovy',
  haskell: 'Haskell',
  hs: 'Haskell',
  html: 'HTML',
  ini: 'INI',
  java: 'Java',
  javascript: 'JavaScript',
  js: 'JavaScript',
  json: 'JSON',
  json5: 'JSON5',
  jsonc: 'JSON',
  jsx: 'JSX',
  julia: 'Julia',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  latex: 'LaTeX',
  less: 'Less',
  lisp: 'Lisp',
  lua: 'Lua',
  makefile: 'Makefile',
  matlab: 'MATLAB',
  md: 'Markdown',
  markdown: 'Markdown',
  mermaid: 'Mermaid',
  m: 'Objective-C',
  'objective-c': 'Objective-C',
  objc: 'Objective-C',
  ml: 'OCaml',
  ocaml: 'OCaml',
  nginx: 'Nginx',
  perl: 'Perl',
  php: 'PHP',
  plaintext: 'Text',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  proto: 'Protobuf',
  protobuf: 'Protobuf',
  py: 'Python',
  python: 'Python',
  r: 'R',
  rb: 'Ruby',
  ruby: 'Ruby',
  rs: 'Rust',
  rust: 'Rust',
  sass: 'Sass',
  scala: 'Scala',
  scss: 'SCSS',
  sh: 'Shell',
  shell: 'Shell',
  solidity: 'Solidity',
  sql: 'SQL',
  svelte: 'Svelte',
  swift: 'Swift',
  tex: 'LaTeX',
  text: 'Text',
  toml: 'TOML',
  ts: 'TypeScript',
  tsx: 'TSX',
  twig: 'Twig',
  typescript: 'TypeScript',
  txt: 'Text',
  vb: 'Visual Basic',
  vbnet: 'VB.NET',
  verilog: 'Verilog',
  vhdl: 'VHDL',
  vue: 'Vue',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  zig: 'Zig',
  zsh: 'Zsh',
}

function languageLabel(raw: string): string {
  const key = raw.trim().toLowerCase()
  if (!key) return ''
  const known = LANGUAGE_LABELS[key]
  if (known) return known
  // Unknown fence info: show it as written, only tidying the shape.
  if (key.length <= 4) return key.toUpperCase()
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function languageOf(node: any): string {
  const classes: unknown = node.properties?.className
  if (!Array.isArray(classes)) return ''
  for (const name of classes) {
    if (typeof name !== 'string') continue
    const match = /^language-(.+)$/.exec(name)
    if (match) return match[1]
  }
  return ''
}

function splitLines(nodes: any[]): any[][] {
  const lines: any[][] = [[]]
  const push = (node: any) => lines[lines.length - 1].push(node)

  for (const node of nodes) {
    if (node.type === 'text') {
      const parts = String(node.value ?? '').split('\n')
      parts.forEach((part, index) => {
        if (index > 0) lines.push([])
        if (part.length) push({ type: 'text', value: part })
      })
      continue
    }
    if (node.type === 'element' && Array.isArray(node.children)) {
      // A highlighted token can span several lines (block comments, template
      // strings), so the element itself has to be split as well.
      const chunks = splitLines(node.children)
      chunks.forEach((chunk, index) => {
        if (index > 0) lines.push([])
        push({ ...node, children: chunk })
      })
      continue
    }
    push(node)
  }
  return lines
}

export function rehypeCodeLines() {
  return (tree: any) => {
    visit(tree, 'element', (node: any, index?: number, parent?: any) => {
      if (!parent || typeof index !== 'number') return
      if (node.tagName !== 'pre') return index + 1

      const code = (node.children || []).find(
        (child: any) => child.type === 'element' && child.tagName === 'code',
      )
      if (!code || !Array.isArray(code.children)) return index + 1

      const language = languageOf(code)
      if (language === 'math') return index + 1

      const lines = splitLines(code.children)
      // A fenced block always ends with a newline; drop the empty tail.
      if (lines.length > 1 && lines[lines.length - 1].length === 0) {
        lines.pop()
      }
      code.children = lines.map((children, line) => ({
        type: 'element',
        tagName: 'span',
        properties: { className: ['code-line'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-ln'], ariaHidden: 'true' },
            children: [{ type: 'text', value: String(line + 1) }],
          },
          { type: 'element', tagName: 'span', properties: { className: ['code-text'] }, children },
        ],
      }))

      const classes = Array.isArray(node.properties?.className) ? node.properties.className : []
      node.properties = { ...(node.properties || {}), className: [...classes, 'code-block'] }

      const label = languageLabel(language)
      if (!label) return index + 1

      // The label sits in a header strip instead of floating over the code, so
      // it never covers a line and is not clipped by the horizontal scroller.
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-wrap'], dataLang: label },
        children: [node],
      }
      return index + 1
    })
  }
}
