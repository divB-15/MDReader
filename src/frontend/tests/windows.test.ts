import { describe, expect, it } from 'vitest'
import type { DocSource } from '../src/lib/types'
import {
  isHostCommand,
  normalizeWindowInit,
  tabTransferPayload,
  transferredToSource,
} from '../src/lib/hostCommands'

const hostDoc: DocSource = {
  id: 'D:/notes/a.md',
  path: 'D:/notes/a.md',
  name: 'a.md',
  dir: 'D:/notes',
  content: '# A'.repeat(1000),
  provider: 'host',
}

const memoryDoc: DocSource = {
  id: 'memory:a.md:12:0',
  path: 'a.md',
  name: 'a.md',
  dir: '',
  content: '# dropped',
  provider: 'memory',
}

describe('tab transfer payload', () => {
  it('does not ship host-document content across the bridge', () => {
    const payload = tabTransferPayload(hostDoc)
    expect(payload).toEqual({
      id: 'D:/notes/a.md',
      path: 'D:/notes/a.md',
      name: 'a.md',
      dir: 'D:/notes',
      provider: 'host',
    })
    expect('content' in payload).toBe(false)
  })

  it('keeps content for documents that only live in memory', () => {
    const payload = tabTransferPayload(memoryDoc)
    expect(payload.content).toBe('# dropped')
    expect(payload.provider).toBe('memory')
  })

  it('re-reads host docs and rebuilds memory docs', () => {
    expect(transferredToSource(tabTransferPayload(hostDoc))).toBeNull()
    expect(transferredToSource(tabTransferPayload(memoryDoc))).toEqual(memoryDoc)
  })
})

describe('window init payload', () => {
  it('keeps valid commands in order', () => {
    const init = normalizeWindowInit({
      windowId: 2,
      restore: false,
      commands: [
        { type: 'open', path: 'D:/a.md' },
        { type: 'add', doc: tabTransferPayload(hostDoc) },
        { type: 'remove', id: 'x' },
        { type: 'toast', text: 'hi' },
      ],
    })
    expect(init.windowId).toBe(2)
    expect(init.restore).toBe(false)
    expect(init.commands.map((c) => c.type)).toEqual(['open', 'add', 'remove', 'toast'])
  })

  it('drops malformed commands instead of crashing the renderer', () => {
    const init = normalizeWindowInit({
      commands: [
        null,
        42,
        { type: 'open' },
        { type: 'unknown' },
        { type: 'remove', id: 7 },
        { type: 'open', path: '' },
        { type: 'toast', text: 'ok' },
      ],
    })
    expect(init.commands).toEqual([{ type: 'toast', text: 'ok' }])
  })

  it('is safe for missing / non-object payloads', () => {
    expect(normalizeWindowInit(null)).toEqual({ windowId: 0, restore: false, commands: [] })
    expect(normalizeWindowInit('{"restore":true}')).toEqual({
      windowId: 0,
      restore: false,
      commands: [],
    })
    expect(normalizeWindowInit({ restore: 1, commands: 'nope' }).restore).toBe(false)
  })

  it('restores only on an explicit true from the host', () => {
    expect(normalizeWindowInit({ restore: true }).restore).toBe(true)
    expect(isHostCommand({ type: 'open', path: 'a.md' })).toBe(true)
  })
})
