export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}_-]/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

export function headingText(node: any): string {
  let out = ''
  const walk = (current: any) => {
    if (!current) return
    // `inlineMath` is what remark-math emits for $...$; without it a formula in a
    // heading silently disappears from the outline and from the anchor id.
    if (
      current.type === 'text' ||
      current.type === 'inlineCode' ||
      current.type === 'math' ||
      current.type === 'inlineMath'
    ) {
      out += current.value ?? ''
    }
    if (current.type === 'image') out += current.alt ?? ''
    if (Array.isArray(current.children)) current.children.forEach(walk)
  }
  walk(node)
  return out.trim()
}
