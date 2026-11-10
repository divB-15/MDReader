import type { DocSource, FolderListing, FileInfo } from '../types'
import { baseName, dirOf, isMarkdownPath } from './paths'

interface MemoryFolder {
  root: string
  name: string
  files: Map<string, File>
}

interface DroppedEntry {
  path: string
  file: File
}

let memoryFolder: MemoryFolder | null = null
const objectUrls = new Map<string, string>()

function revokeAllUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url)
  objectUrls.clear()
}

function toFileInfos(files: Map<string, File>, root: string): FileInfo[] {
  const list: FileInfo[] = []
  for (const [path] of files) {
    if (!isMarkdownPath(path)) continue
    list.push({
      path,
      name: baseName(path),
      dir: dirOf(path),
      rel: path.slice(root ? root.length + 1 : 0),
    })
  }
  list.sort((a, b) => a.rel.localeCompare(b.rel, 'zh-Hans-CN'))
  return list
}

export function resetMemoryFolder(): void {
  memoryFolder = null
  revokeAllUrls()
}

export async function adoptEntries(
  entries: DroppedEntry[],
  openFirst: boolean,
): Promise<{ listing: FolderListing; first: DocSource | null } | null> {
  if (!entries.length) return null
  const normalized = entries.map((entry) => ({ ...entry, path: entry.path.replace(/\\/g, '/') }))
  const firstPath = normalized[0].path
  const root = firstPath.includes('/') ? firstPath.split('/')[0] : ''
  const map = new Map<string, File>()
  for (const entry of normalized) {
    if (!map.has(entry.path)) map.set(entry.path, entry.file)
  }
  revokeAllUrls()
  memoryFolder = { root, name: root, files: map }
  const listing: FolderListing = { root, name: root, files: toFileInfos(map, root) }

  let first: DocSource | null = null
  if (openFirst && listing.files.length) {
    const entry = listing.files[0]
    const file = map.get(entry.path)
    if (file) {
      first = {
        id: entry.path,
        path: entry.path,
        name: entry.name,
        dir: dirOf(entry.path),
        content: await file.text(),
        provider: 'memory',
      }
    }
  }
  return { listing, first }
}

export function filesToEntries(files: File[]): DroppedEntry[] {
  return files
    .filter((file) => file.webkitRelativePath && file.webkitRelativePath.includes('/'))
    .map((file) => ({ path: file.webkitRelativePath.replace(/\\/g, '/'), file }))
}

export function pickFiles(directory: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (directory) {
      ;(input as any).webkitdirectory = true
    } else {
      input.accept = '.md,.markdown,.mdown,.mkd,.mdx,.txt,.MD,.MARKDOWN,.TXT'
    }
    let settled = false
    input.onchange = () => {
      settled = true
      resolve(Array.from(input.files || []))
    }
    input.oncancel = () => {
      if (!settled) resolve([])
    }
    input.click()
  })
}

export async function singleDocFromFile(file: File): Promise<DocSource> {
  return {
    id: `memory:${file.name}:${file.size}:${file.lastModified}`,
    path: file.name.replace(/\\/g, '/'),
    name: file.name,
    dir: '',
    content: await file.text(),
    provider: 'memory',
  }
}

async function readDirectoryEntry(
  entry: any,
  prefix: string,
  out: DroppedEntry[],
  depth: number,
): Promise<void> {
  if (depth > 8 || out.length > 5000) return
  if (entry.isFile) {
    const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject))
    out.push({ path: prefix + entry.name, file })
    return
  }
  if (!entry.isDirectory) return
  const reader = entry.createReader()
  const readBatch = (): Promise<any[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject))
  for (;;) {
    const batch = await readBatch()
    if (!batch.length) break
    for (const child of batch) {
      await readDirectoryEntry(child, prefix + entry.name + '/', out, depth + 1)
    }
  }
}

export async function entriesFromDataTransfer(items: DataTransferItemList | null): Promise<DroppedEntry[]> {
  if (!items || !items.length) return []
  const out: DroppedEntry[] = []
  const walk = async (item: DataTransferItem) => {
    const entry = (item as any).webkitGetAsEntry?.()
    if (!entry) return
    if (entry.isFile) {
      const file = item.getAsFile()
      if (file) out.push({ path: entry.name, file })
      return
    }
    await readDirectoryEntry(entry, '', out, 0)
  }
  const promises: Promise<void>[] = []
  for (let index = 0; index < items.length; index++) promises.push(walk(items[index]))
  await Promise.all(promises)
  return out
}

export async function readMemoryDoc(path: string): Promise<DocSource | null> {
  const file = memoryFolder?.files.get(path.replace(/\\/g, '/'))
  if (!file || !isMarkdownPath(path)) return null
  return {
    id: path,
    path,
    name: baseName(path),
    dir: dirOf(path),
    content: await file.text(),
    provider: 'memory',
  }
}

export async function readMemoryImage(absolute: string): Promise<string | null> {
  const cached = objectUrls.get(absolute)
  if (cached) return cached
  let file = memoryFolder?.files.get(absolute)
  if (!file) {
    // Last resort: match by file name. Helps when a document moved between
    // folders but still points at `images/a.png`.
    const wanted = baseName(absolute).toLowerCase()
    for (const [key, value] of memoryFolder?.files || []) {
      if (baseName(key).toLowerCase() === wanted) {
        file = value
        break
      }
    }
  }
  if (!file) return null
  const url = URL.createObjectURL(file)
  objectUrls.set(absolute, url)
  return url
}
