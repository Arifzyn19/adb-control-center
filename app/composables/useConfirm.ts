export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((value: boolean) => void) | null
}

let state: ReturnType<typeof useState<ConfirmState>> | undefined

function getState() {
  if (!state) {
    state = useState<ConfirmState>('confirm', () => ({ open: false, title: '', destructive: false, resolve: null }))
  }
  return state
}

export function useConfirm() {
  const s = getState()

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      s.value = {
        ...options,
        open: true,
        confirmLabel: options.confirmLabel || (options.destructive ? 'Delete' : 'Confirm'),
        resolve,
      }
    })
  }

  function resolve(value: boolean) {
    const resolver = s.value.resolve
    s.value.open = false
    s.value.resolve = null
    resolver?.(value)
  }

  return { state: s, confirm, resolve }
}