import type { LogEntry, LogLevel } from '../../../shared/types'
import * as logcatService from '../../services/logcat'

const FLUSH_INTERVAL_MS = 120

const closedPeers = new WeakSet<object>()

interface FilterMessage {
  type?: string
  level?: string
  tag?: string
  package?: string
}

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

  open(peer) {
    const serial = peer.context?.serial as string
    const filters = { level: 'ALL' as LogLevel, tag: undefined as string | undefined, packageName: undefined as string | undefined }

    const queue: LogEntry[] = []
    let flushed = false
    let closed = false
    let detach: (() => void) | null = null

    const flush = () => {
      flushed = false
      if (queue.length === 0) return
      const entries = queue.splice(0)
      if (!closed) {
        try {
          peer.send(JSON.stringify({ type: 'batch', entries }))
        } catch {
          /* ignore */
        }
      }
    }

    const pushEntry = (entry: LogEntry) => {
      if (closed) return
      queue.push(entry)
      if (!flushed) {
        flushed = true
        setTimeout(flush, FLUSH_INTERVAL_MS)
      }
    }

    logcatService
      .attachLogcat(serial, filters, pushEntry)
      .then((unsub) => {
        if (closed) unsub()
        else detach = unsub
      })
      .catch((err) => {
        if (!closed) {
          try {
            peer.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Logcat failed' }))
          } catch {
            /* ignore */
          }
        }
      })

    peer.context._state = {
      flush,
      cleanup: () => {
        closed = true
        flush()
        if (detach) detach()
      },
    }

    const initial = logcatService.getBuffer(serial).slice(-500)
    if (initial.length) {
      peer.send(JSON.stringify({ type: 'buffer', entries: initial }))
    }
    peer.send(JSON.stringify({ type: 'hello', serial }))
  },

  message(peer, message) {
    const serial = peer.context?.serial as string
    try {
      const data = message.json() as FilterMessage | null
      if (data?.type === 'filters') {
        const level = (['ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const).includes(data.level as LogLevel)
          ? (data.level as LogLevel)
          : 'ALL'
        const tag = typeof data.tag === 'string' && data.tag.length <= 200 ? data.tag : undefined
        const packageName = typeof data.package === 'string' && data.package.length <= 255 ? data.package : undefined
        logcatService.setFilters(serial, { level, tag, packageName })
        peer.send(JSON.stringify({ type: 'filters-applied', level, tag, package: packageName }))
      } else if (data?.type === 'ping') {
        peer.send(JSON.stringify({ type: 'pong' }))
      }
    } catch {
      /* ignore */
    }
  },

  close(peer) {
    closedPeers.add(peer)
    ;(peer.context?._state as { cleanup?: () => void } | undefined)?.cleanup?.()
  },
})