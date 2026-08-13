import { bus } from '../../utils/bus'
import * as deviceManager from '../../services/device-manager'

const closedPeers = new WeakSet<object>()

export default defineWebSocketHandler({
  upgrade(request) {
    const url = new URL(request.url)
    const token = url.searchParams.get('token') || undefined
    const session = getSession(token)
    if (!session) {
      throw new Response('Unauthorized', { status: 401 })
    }
    const serial = url.searchParams.get('serial') || undefined
    return { context: { serial, session } } as unknown as void
  },

  open(peer) {
    const serial = peer.context?.serial as string | undefined
    const send = (device: unknown) => {
      if (!closedPeers.has(peer)) {
        try {
          peer.send(JSON.stringify({ type: 'device', serial, device }))
        } catch {
          /* ignore */
        }
      }
    }

    const onUpdate = (s: string, device: unknown) => {
      if (!serial || s === serial) send(device)
    }
    const onRemove = (s: string) => {
      if (!serial || s === serial) {
        try {
          peer.send(JSON.stringify({ type: 'removed', serial: s }))
        } catch {
          /* ignore */
        }
      }
    }

    bus.on('device:update', onUpdate)
    bus.on('device:remove', onRemove)
    peer.context._cleanup = () => {
      bus.off('device:update', onUpdate)
      bus.off('device:remove', onRemove)
    }

    if (serial) {
      const device = deviceManager.getDevice(serial)
      if (device) send(device)
      else peer.send(JSON.stringify({ type: 'removed', serial }))
    } else {
      peer.send(JSON.stringify({ type: 'snapshot', devices: deviceManager.listStoredDevices() }))
    }
    peer.send(JSON.stringify({ type: 'hello', time: Date.now() }))
  },

  message(peer, message) {
    try {
      const data = message.json() as { type?: string } | null
      if (data?.type === 'ping') {
        peer.send(JSON.stringify({ type: 'pong' }))
      } else if (data?.type === 'refresh') {
        deviceManager.refreshAll().then((devices) => {
          if (!closedPeers.has(peer)) {
            try {
              peer.send(JSON.stringify({ type: 'snapshot', devices }))
            } catch {
              /* ignore */
            }
          }
        })
      }
    } catch {
      /* ignore malformed */
    }
  },

  close(peer) {
    closedPeers.add(peer)
    ;(peer.context?._cleanup as (() => void) | undefined)?.()
  },
})