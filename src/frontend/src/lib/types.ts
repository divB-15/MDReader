export interface Heading {
  id: string
  text: string
  level: number
}

export interface DocSource {
  id: string
  path: string
  name: string
  dir: string
  content: string
  provider: 'host' | 'memory'
}

export interface Doc extends DocSource {
  html: string
  headings: Heading[]
  state: 'idle' | 'rendering' | 'ready' | 'error'
  error?: string
}

export interface FileInfo {
  path: string
  name: string
  dir: string
  rel: string
}

export interface FolderListing {
  root: string
  name: string
  files: FileInfo[]
}

export interface RecentEntry {
  path: string
  name: string
  dir: string
  at: number
  folder?: string
}
