import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

let _uid = 0

export function useTerminal(serial: Ref<string | null | undefined>) {
  const { token } = useAuth()
  const containerRef = ref<HTMLElement | null>(null)
  const connected = ref(false)
  const error = ref<string | null>(null)
  const uid = ++_uid

  let term: Terminal | null = null
  let fit: FitAddon | null = null
  let ws: WebSocket | null = null
  let resizeObserver: ResizeObserver | null = null
  let buffer = ''

  function init() {
    if (!containerRef.value || term) return
    term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#1c1c1c',
        red: '#f14c4c',
        green: '#23d18b',
        yellow: '#f5f543',
        blue: '#3b8eea',
        magenta: '#d670d6',
        cyan: '#29b8db',
        white: '#e5e5e5',
      },
      scrollback: 5000,
    })
    fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.value)
    fit.fit()
    term.focus()

    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    resizeObserver = new ResizeObserver(() => {
      if (!fit) return
      try {
        fit.fit()
      } catch {
        /* ignore */
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(`__RESIZE__${term!.cols},${term!.rows}`)
      }
    })
    resizeObserver.observe(containerRef.value)
  }

  function connect() {
    if (!serial.value || !token.value || !containerRef.value) return
    init()
    if (ws) disconnect()
    error.value = null

    ws = new WebSocket(wsUrl('/ws/terminal', { serial: serial.value }))
    ws.onopen = () => {
      connected.value = true
      buffer = ''
      term?.reset()
      if (term) {
        ws?.send(`__RESIZE__${term.cols},${term.rows}`)
      }
    }
    ws.onmessage = (event) => {
      const data = event.data as string
      try {
        if (data.startsWith('{')) {
          const msg = JSON.parse(data)
          if (msg.type === 'error') {
            error.value = msg.message
            term?.writeln(`\x1b[31m${msg.message}\x1b[0m`)
          } else if (msg.type === 'exit') {
            term?.writeln(`\x1b[90m[session ended: ${msg.reason}]\x1b[0m`)
          }
          return
        }
      } catch {
        /* binary/text */
      }
      term?.write(data)
    }
    ws.onclose = () => {
      connected.value = false
      ws = null
      term?.writeln('\x1b[90m[disconnected]\x1b[0m')
    }
    ws.onerror = () => {
      error.value = 'Terminal connection failed.'
    }
  }

  function disconnect() {
    if (ws) {
      ws.onclose = null
      ws.close()
      ws = null
    }
    connected.value = false
  }

  function write(text: string) {
    term?.write(text)
  }

  onMounted(() => {
    connect()
  })

  onBeforeUnmount(() => {
    disconnect()
    resizeObserver?.disconnect()
    term?.dispose()
    term = null
  })

  watch(serial, () => {
    if (import.meta.client) connect()
  })

  return {
    containerRef,
    connected,
    error,
    connect,
    disconnect,
    write,
  }
}