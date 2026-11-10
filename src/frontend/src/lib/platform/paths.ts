export const MD_EXT = /\.(md|markdown|mdown|mkd|mdx|txt)$/i

export function isMarkdownPath(path: string): boolean {
  return MD_EXT.test(path)
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function normalizeSrc(src: string): string {
  return safeDecode(src.trim())
    .replace(/\\/g, '/')
    .replace(/^file:\/\/\//i, '')
    .replace(/[?#].*$/, '')
}

export function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:\//.test(path) || path.startsWith('//') || path.startsWith('/')
}

export function joinPath(dir: string, src: string): string {
  const clean = normalizeSrc(src)
  if (isAbsolutePath(clean)) return clean
  const base = dir.replace(/\\/g, '/').split('/').filter(Boolean)
  const out = [...base]
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (out.length) out.pop()
    } else {
      out.push(part)
    }
  }
  return out.join('/')
}

export function dirOf(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const index = norm.lastIndexOf('/')
  return index >= 0 ? norm.slice(0, index) : ''
}

export function baseName(path: string): string {
  const norm = path.replace(/\\/g, '/')
  return norm.slice(norm.lastIndexOf('/') + 1)
}
