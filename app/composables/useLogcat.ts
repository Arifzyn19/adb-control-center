import type { LogEntry, LogLevel } from '../../shared/types'

interface FilterState {
  level: LogLevel
  tag: string
  packageName: string
}

const MAX_CLIENT_BUFFER = 3000

export function useLogcat(serial: Ref<string | null | undefined>) {
  const { token } = useAuth()
  const entries = ref<LogEntry[]>([])
  const connected = ref(false)
  const live = ref(true)
  const regex = ref(false)
  const showTimestamps = ref(true)
  const wrap = ref(false)
  const search = ref('')
  const level = ref<LogLevel>('ALL')
  const tag = ref('')
  const packageName = ref('')
  const error = ref<string | null>(null)

  let ws: WebSocket | null = null
  let lastFilters = ''

  function connect() {
    if (!serial.value || !token.value) return
    disconnect()
    error.value = null
    ws = new WebSocket(wsUrl('/ws/logcat', { serial: serial.value }))

    ws.onopen = () => {
      connected.value = true
      sendFilters()
    }
    ws.onclose = () => {
      connected.value = false
      ws = null
    }
    ws.onerror = () => {
      error.value = 'Logcat connection failed.'
    }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'buffer' || msg.type === 'batch') {
          const items = (msg.entries || []) as LogEntry[]
          if (msg.type === 'buffer') {
            entries.value = items
          } else if (live.value) {
            entries.value = [...entries.value, ...items]
            if (entries.value.length > MAX_CLIENT_BUFFER) {
              entries.value.splice(0, entries.value.length - MAX_CLIENT_BUFFER)
            }
          }
        } else if (msg.type === 'error') {
          error.value = msg.message
        }
      } catch {
        /* ignore */
      }
    }
  }

  function sendFilters() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const current = JSON.stringify({ level: level.value, tag: tag.value.trim(), package: packageName.value.trim() })
    if (current === lastFilters) return
    lastFilters = current
    ws.send(JSON.stringify({ type: 'filters', level: level.value, tag: tag.value.trim(), package: packageName.value.trim() }))
  }

  function disconnect() {
    if (ws) {
      ws.onclose = null
      ws.close()
      ws = null
    }
    connected.value = false
  }

  watch([serial, token], () => {
    if (serial.value) connect()
  }, { immediate: true })

  watch([level, tag, packageName], () => {
    sendFilters()
  })

  onBeforeUnmount(() => disconnect())

  const filtered = computed(() => {
    const q = search.value
    if (!q) return entries.value
    let query: RegExp
    try {
      query = regex.value ? new RegExp(q, 'i') : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    } catch {
      return entries.value
    }
    return entries.value.filter((e) => query.test(e.message) || query.test(e.tag) || query.test(e.raw))
  })

  const displayEntries = computed(() => {
    if (!showTimestamps.value) return filtered.value
    return filtered.value
  })

  function clearLocal() {
    entries.value = []
  }

  async function clearDevice() {
    if (!serial.value) return
    await apiRequest(`/api/devices/${encodeURIComponent(serial.value)}/logcat/clear`, { method: 'POST' })
    entries.value = []
  }

  async function exportLogs(): Promise<void> {
    if (!serial.value) return
    const { text } = await apiRequest<{ text: string }>(
      `/api/devices/${encodeURIComponent(serial.value)}/logcat/dump?level=${level.value}`,
    )
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logcat-${serial.value}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyLine(entry: LogEntry) {
    navigator.clipboard.writeText(entry.raw)
  }

  function copySelected(lines: string) {
    navigator.clipboard.writeText(lines)
  }

  function jumpToLatest() {
    entries.value.splice(0)
  }

  return {
    entries,
    displayEntries,
    filtered,
    connected,
    live,
    regex,
    showTimestamps,
    wrap,
    search,
    level,
    tag,
    packageName,
    error,
    connect,
    disconnect,
    clearLocal,
    clearDevice,
    exportLogs,
    copyLine,
    copySelected,
  }
}