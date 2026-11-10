import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { visit } from 'unist-util-visit'

/* ---------------------------------- safety ----------------------------------- */

// Tags that are dropped together with their content: they either execute code,
// pull remote resources or would let a document escape the reading surface.
const DROP_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'button',
  'select',
  'option',
  'textarea',
  'link',
  'meta',
  'base',
  'template',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'dialog',
])

function normalizeImage(node: any) {
  const props = node.properties || (node.properties = {})
  // `style` on an image is the one place a document may express layout.
  // Keep only numeric box constraints, drop everything else.
  if (typeof props.style === 'string') {
    const style = props.style as string
    const width = /width\s*:\s*([0-9.]+(?:px|%|em|rem)?)/i.exec(style)
    const height = /height\s*:\s*([0-9.]+(?:px|%|em|rem)?)/i.exec(style)
    if (width && !props.width) props.width = width[1]
    if (height && !props.height) props.height = height[1]
    delete props.style
  }
  delete props.srcset
  delete props.sizes
  delete props.usemap
}

function cleanAttributes(node: any) {
  const props = node.properties
  if (!props) return
  for (const key of Object.keys(props)) {
    const lower = key.toLowerCase()
    if (lower.startsWith('on') || lower === 'srcset' || lower === 'formaction' || lower === 'xlink:href') {
      delete props[key]
    }
  }
  for (const key of ['href', 'src', 'action']) {
    const value = props[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (
      /^javascript:/i.test(trimmed) ||
      /^vbscript:/i.test(trimmed) ||
      /^data:text\/html/i.test(trimmed) ||
      /^data:application\/xhtml/i.test(trimmed)
    ) {
      delete props[key]
    }
  }
}

function transformTree(node: any): any[] | null {
  if (node.type === 'element' && DROP_TAGS.has(node.tagName)) return null

  if (node.type === 'element' && node.tagName === 'input') {
    // GFM task lists are the only inputs a document is allowed to render.
    const type = String(node.properties?.type || '').toLowerCase()
    if (type !== 'checkbox') return null
    node.properties = {
      type: 'checkbox',
      checked: node.properties?.checked,
      disabled: true,
    }
  }

  if (node.type === 'element') {
    cleanAttributes(node)
    if (node.tagName === 'img') normalizeImage(node)
  }

  if (Array.isArray(node.children)) {
    const next: any[] = []
    for (const child of node.children) {
      const out = transformTree(child)
      if (out) next.push(...out)
    }
    node.children = next
    if (node.type === 'element' && node.tagName === 'p') {
      const meaningful = node.children.some(
        (child: any) =>
          child.type === 'element' ||
          (child.type === 'text' && (child.value || '').trim().length > 0),
      )
      if (!meaningful) return null
    }
  }
  return [node]
}

export function rehypeSafeHtml() {
  return (tree: any) => {
    const result = transformTree(tree)
    if (result && result[0]) {
      tree.children = result[0].children ?? []
    }
  }
}

export const markdownSanitizeSchema: any = {
  ...defaultSchema,
  clobberPrefix: '',
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'details',
    'summary',
    'dl',
    'dt',
    'dd',
    'sup',
    'sub',
    'mark',
    'kbd',
    'abbr',
    'cite',
    'figure',
    'figcaption',
    'span',
    'div',
    'section',
    'small',
    'u',
    'ins',
    'del',
    'time',
    'input',
  ],
  attributes: {
    ...(defaultSchema.attributes || {}),
    a: ['href', 'title', 'className', ['id', /^(fn|fnref)-\d+$/], 'dataFootnoteRef', 'dataFootnoteBackref'],
    img: ['src', 'alt', 'title', 'width', 'height', 'align', 'loading'],
    code: ['className'],
    pre: ['className'],
    span: ['className'],
    div: ['className'],
    section: ['className', 'dataFootnotes'],
    sup: ['className'],
    sub: ['className'],
    figure: ['className'],
    table: ['className', 'align'],
    th: ['align', 'className'],
    td: ['align', 'className'],
    ol: ['start', 'reversed', 'type'],
    li: ['value', 'className'],
    input: ['type', 'checked', 'disabled'],
    details: ['open', 'className'],
    summary: ['className'],
    h1: ['id', 'className'],
    h2: ['id', 'className'],
    h3: ['id', 'className'],
    h4: ['id', 'className'],
    h5: ['id', 'className'],
    h6: ['id', 'className'],
  },
  protocols: {
    ...(defaultSchema.protocols || {}),
    // No `file`: local attachments are never opened from a document, and letting
    // the scheme through would leave the shell's "open link" menu able to start
    // an executable.
    href: ['http', 'https', 'mailto', 'tel'],
    src: ['http', 'https', 'data', 'blob', 'file'],
  },
}

/* ------------------------------- local images -------------------------------- */

function isRemoteSource(src: string): boolean {
  return /^(https?:|data:|blob:|mailto:|tel:)/i.test(src.trim())
}

// Relative and file:// sources cannot be fetched from the reader directly.
// They are parked in `data-src` and resolved by the platform layer after mount.
export function rehypeLocalImages() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName !== 'img') return
      const src = node.properties?.src
      if (typeof src !== 'string') return
      if (isRemoteSource(src)) {
        // Remote pictures are the only thing a document can load over the
        // network. Keep the request anonymous and out of the critical path.
        node.properties.referrerPolicy = 'no-referrer'
        node.properties.loading = 'lazy'
        return
      }
      const cleaned = src.replace(/^file:\/\/\//i, '')
      node.properties.dataSrc = cleaned
      delete node.properties.src
    })
  }
}

export { rehypeSanitize }
