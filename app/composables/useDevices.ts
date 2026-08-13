import type { DeviceInfo } from '../../shared/types'

let state:
  | {
      devices: ReturnType<typeof useState<DeviceInfo[]>>
      selectedSerial: ReturnType<typeof useState<string | null>>
    }
  | undefined

function getState() {
  if (!state) {
    state = {
      devices: useState<DeviceInfo[]>('devices', () => []),
      selectedSerial: useState<string | null>('selected-serial', () => null),
    }
  }
  return state
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
let started = false

export function useDevices() {
  const { devices, selectedSerial } = getState()
  const { token } = useAuth()
  const toast = useToast()

  function start() {
    if (started) return
    started = true
    connect()
    refreshTimer = setInterval(() => refresh(), 20_000)
  }

  function connect() {
    if (!token.value) return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    try {
      ws = new WebSocket(wsUrl('/ws/device-status'))
    } catch {
      scheduleReconnect()
      return
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'device') {
          upsert(msg.device)
        } else if (msg.type === 'removed') {
          devices.value = devices.value.filter((d) => d.serial !== msg.serial)
        } else if (msg.type === 'snapshot') {
          devices.value = msg.devices
        }
      } catch {
        /* ignore */
      }
    }

    ws.onclose = () => {
      if (ws?.readyState !== WebSocket.CLOSING) scheduleReconnect()
      ws = null
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 5000)
  }

  function upsert(device: DeviceInfo) {
    const idx = devices.value.findIndex((d) => d.serial === device.serial)
    if (idx === -1) {
      devices.value = [...devices.value, device]
    } else {
      const next = [...devices.value]
      next[idx] = device
      devices.value = next
    }
  }

  async function refresh(): Promise<DeviceInfo[]> {
    const data = await apiRequest<DeviceInfo[]>('/api/devices')
    devices.value = data
    return data
  }

  async function connectDevice(address: string): Promise<DeviceInfo> {
    const device = await apiRequest<DeviceInfo>('/api/devices/connect', { method: 'POST', body: JSON.stringify({ address }) })
    upsert(device)
    toast.success('Device connected', device.name)
    return device
  }

  async function disconnect(serial: string) {
    await apiRequest<{ disconnected: string }>('/api/devices/disconnect', { method: 'POST', body: JSON.stringify({ serial }) })
    const device = devices.value.find((d) => d.serial === serial)
    toast.info('Device disconnected', device?.name || serial)
  }

  async function remove(serial: string) {
    await apiRequest<{ removed: string }>(`/api/devices/${encodeURIComponent(serial)}`, { method: 'DELETE' })
    devices.value = devices.value.filter((d) => d.serial !== serial)
    toast.info('Device removed', serial)
  }

  function select(serial: string | null) {
    selectedSerial.value = serial
  }

  const getDevice = (serial: string | null | undefined): DeviceInfo | undefined =>
    devices.value.find((d) => d.serial === serial)

  const onlineCount = computed(() => devices.value.filter((d) => d.status === 'connected').length)
  const offlineCount = computed(() => devices.value.filter((d) => d.status !== 'connected').length)

  return {
    devices,
    selectedSerial,
    start,
    refresh,
    connectDevice,
    disconnect,
    remove,
    select,
    getDevice,
    onlineCount,
    offlineCount,
  }
}