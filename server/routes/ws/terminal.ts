import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import * as adb from '../../services/adb'

interface TerminalContext {
  child: ChildProcessWithoutNullStreams | null
  serial: string
}

const closedPeers = new WeakSet<object>()

export default defineWebSocketHandler({
  upgrade(request) {
    const url = new URL(request.url)
    const token = url.searchParams.get('token') || undefined
    const session = getAuthSession(token)
    if (!session) {
      throw new Response('Unauthorized', { status: 401 })
    }
    const serial = url.searchParams.get('serial')
    if (!serial || !/^[A-Za-z0-9._:-]{1,64}$/.test(serial)) {
      throw new Response('Invalid device serial', { status: 400 })
    }
    return { context: { serial, session } } as unknown as void
  },

  async open(peer) {
    const serial = peer.context?.serial as string

    try {
      await adb.checkDeviceAvailable(serial)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Device unavailable'
      peer.send(JSON.stringify({ type: 'error', message }))
      peer.close()
      return
    }

    const child = adb.spawnShell(serial)
    const state: TerminalContext = { child, serial }

    let killTimer: ReturnType<typeof setTimeout> | null = null
    const heartbeat = () => {
      if (killTimer) clearTimeout(killTimer)
      killTimer = setTimeout(() => {
        if (!closedPeers.has(peer)) {
          peer.send(JSON.stringify({ type: 'exit', reason: 'session-idle' }))
          peer.close()
        }
      }, 30 * 60 * 1000)
    }
    heartbeat()

    child.stdout.on('data', (data: Buffer) => {
      if (!closedPeers.has(peer)) peer.send(data.toString('utf8'))
    })
    child.stderr.on('data', (data: Buffer) => {
      if (!closedPeers.has(peer)) peer.send(data.toString('utf8'))
    })
    child.on('error', () => {
      if (!closedPeers.has(peer)) {
        peer.send(JSON.stringify({ type: 'error', message: 'Failed to start ADB shell.' }))
        peer.close()
      }
    })
    child.on('close', () => {
      if (!closedPeers.has(peer)) {
        peer.send(JSON.stringify({ type: 'exit', reason: 'shell-exit' }))
        peer.close()
      }
    })

    peer.context._state = {
      child,
      close: () => {
        if (killTimer) clearTimeout(killTimer)
        state.child = null
        if (child && !child.killed) {
          try {
            child.stdin.end()
            child.kill()
          } catch {
            /* ignore */
          }
        }
      },
    }

    peer.send(JSON.stringify({ type: 'ready', serial }))
  },

  message(peer, message) {
    const state = peer.context?._state as { child: ChildProcessWithoutNullStreams | null } | undefined
    if (!state?.child) return
    try {
      const text = message.text()
      if (text === '___RESIZE___') return
      if (text.startsWith('__RESIZE__')) {
        const parts = text.slice(10).split(',')
        const cols = Number(parts[0])
        const rows = Number(parts[1])
        if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0) {
          const csi = `\x1b[8;${rows};${cols}t`
          state.child.stdin.write(csi)
        }
        return
      }
      state.child.stdin.write(text)
    } catch {
      /* ignore */
    }
  },

  close(peer) {
    closedPeers.add(peer)
    const cleanup = (peer.context?._state as { close?: () => void } | undefined)?.close
    cleanup?.()
  },
})