export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration: number
}

let state: ReturnType<typeof useState<ToastItem[]>> | undefined
let nextId = 1

function getState() {
  if (!state) state = useState<ToastItem[]>('toasts', () => [])
  return state
}

function dismiss(id: number) {
  const s = getState()
  s.value = s.value.filter((t) => t.id !== id)
}

function push(type: ToastItem['type'], title: string, message?: string, duration = 4000) {
  const s = getState()
  const id = nextId++
  s.value = [...s.value, { id, type, title, message, duration }]
  setTimeout(() => dismiss(id), duration)
}

export function useToast() {
  const toasts = useState<ToastItem[]>('toasts', () => [])

  return {
    toasts,
    dismiss,
    success: (title: string, message?: string) => push('success', title, message),
    error: (title: string, message?: string) => push('error', title, message, 6000),
    info: (title: string, message?: string) => push('info', title, message),
    warning: (title: string, message?: string) => push('warning', title, message),
  }
}