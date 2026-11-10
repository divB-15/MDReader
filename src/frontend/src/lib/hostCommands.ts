import type { DocSource } from './types'

/**
 * A tab travelling between windows.
 *
 * Host-backed documents are re-read by the destination through mrOpenPath, so
 * their (possibly multi-megabyte) Markdown never crosses the WebView2 message
 * bridge. Documents that only exist in browser memory have no path to re-read
 * and therefore carry their content along.
 */
export interface TransferredDoc {
  id: string
  path: string
  name: string
  dir: string
  provider: 'host' | 'memory'
  content?: string
}

export type HostCommand =
  | { type: 'open'; path: string }
  | { type: 'add'; doc: TransferredDoc }
  | { type: 'remove'; id: string }
  | { type: 'toast'; text: string }

/** Payload of mrWindowReady: the renderer's identity plus queued commands. */
export interface WindowInit {
  windowId: number
  restore: boolean
  commands: HostCommand[]
}

export function tabTransferPayload(doc: DocSource): TransferredDoc {
  const base: TransferredDoc = {
    id: doc.id,
    path: doc.path,
    name: doc.name,
    dir: doc.dir,
    provider: doc.provider,
  }
  return doc.provider === 'host' ? base : { ...base, content: doc.content }
}

export function transferredToSource(doc: TransferredDoc): DocSource | null {
  if (typeof doc.content !== 'string') return null
  return {
    id: doc.id,
    path: doc.path,
    name: doc.name,
    dir: doc.dir,
    content: doc.content,
    provider: doc.provider,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isHostCommand(value: unknown): value is HostCommand {
  if (!isRecord(value)) return false
  switch (value.type) {
    case 'open':
      return typeof value.path === 'string' && value.path.length > 0
    case 'add':
      return (
        isRecord(value.doc) &&
        typeof value.doc.id === 'string' &&
        typeof value.doc.path === 'string'
      )
    case 'remove':
      return typeof value.id === 'string'
    case 'toast':
      return typeof value.text === 'string'
    default:
      return false
  }
}

/** Never trust a raw bridge payload: drop anything the renderer cannot apply. */
export function normalizeWindowInit(value: unknown): WindowInit {
  const data = isRecord(value) ? value : {}
  const raw = Array.isArray(data.commands) ? data.commands : []
  return {
    windowId: typeof data.windowId === 'number' ? data.windowId : 0,
    restore: data.restore === true,
    commands: raw.filter(isHostCommand),
  }
}
