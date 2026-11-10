import type { DocSource, FolderListing } from '../types'
import { baseName, dirOf } from './paths'

interface HostBridge {
  // webview parses the JSON payload it gets back from C++ before resolving, so
  // these promises hand over values rather than strings. A raw JSON string is
  // still accepted because that is what the host actually sends over the wire.
  mrOpenFile?: (arg: string) => Promise<unknown>
  mrOpenFolder?: (arg: string) => Promise<unknown>
  mrOpenPath?: (arg: string) => Promise<unknown>
  mrReadImage?: (arg: string) => Promise<unknown>
  mrOpenUrl?: (arg: string) => Promise<unknown>
  mrSetTitle?: (arg: string) => Promise<unknown>
  mrSetTopmost?: (arg: string) => Promise<unknown>
  mrWindowReady?: (arg: string) => Promise<unknown>
  mrTabDrop?: (...args: string[]) => Promise<unknown>
  mrWindowAction?: (arg: string) => Promise<unknown>
}

declare global {
  interface Window extends HostBridge {}
}

export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && typeof window.mrOpenFile === 'function'

function decodePayload(value: unknown): Record<string, any> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null
    } catch {
      return null
    }
  }
  return typeof value === 'object' ? (value as Record<string, any>) : null
}

export function parseHostDoc(value: unknown): DocSource | null {
  const data = decodePayload(value)
  if (!data || data.canceled || !data.path) return null
  return {
    id: data.path,
    path: data.path,
    name: data.name || baseName(data.path),
    dir: data.dir || dirOf(data.path),
    content: data.content || '',
    provider: 'host',
  }
}

export async function openHostFile(): Promise<DocSource | null> {
  return parseHostDoc(await window.mrOpenFile!(''))
}

export async function openHostFolder(): Promise<FolderListing | null> {
  const data = decodePayload(await window.mrOpenFolder!(''))
  if (!data || data.canceled) return null
  return data as unknown as FolderListing
}

export async function openHostPath(path: string): Promise<DocSource | null> {
  return parseHostDoc(await window.mrOpenPath!(path))
}

export async function readHostImage(absolute: string): Promise<string | null> {
  const data = decodePayload(await window.mrReadImage!(absolute))
  if (!data?.ok) return null
  return `data:${data.mime || 'image/png'};base64,${data.data}`
}

export async function openHostUrl(url: string): Promise<void> {
  if (window.mrOpenUrl) await window.mrOpenUrl(url)
}

export function setHostTitle(title: string): void {
  if (window.mrSetTitle) void window.mrSetTitle(title)
}

export function setHostTopmost(on: boolean): void {
  if (window.mrSetTopmost) void window.mrSetTopmost(on ? '1' : '0')
}

/**
 * Called once per window, right after installing __mrHostMessage. Returns the
 * window's id, whether it may restore the last document, and every command
 * that arrived before the renderer was ready.
 */
export async function hostWindowInit(): Promise<unknown> {
  if (!window.mrWindowReady) return null
  return window.mrWindowReady('')
}

/** Three string arguments: "x,y,last", the tab payload JSON, the tab id. */
export async function hostTabDrop(
  x: number,
  y: number,
  last: boolean,
  docJson: string,
  id: string,
): Promise<void> {
  if (window.mrTabDrop) await window.mrTabDrop(`${x},${y},${last ? 1 : 0}`, docJson, id)
}

export async function hostWindowAction(
  action: 'minimize' | 'maximize' | 'close' | 'fullscreen',
): Promise<void> {
  if (window.mrWindowAction) await window.mrWindowAction(action)
}
