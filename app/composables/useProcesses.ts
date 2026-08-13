import type { ProcessInfo } from '../../shared/types'

export function useProcesses(serial: Ref<string | null | undefined>) {
  const toast = useToast()
  const processes = ref<ProcessInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const search = ref('')
  const autoRefresh = ref(false)
  const sortBy = ref<'cpu' | 'memory' | 'pid' | 'name'>('cpu')
  let timer: ReturnType<typeof setInterval> | null = null

  const enc = (s: string | null | undefined) => (s ? encodeURIComponent(s) : '')

  async function load() {
    if (!serial.value) return
    loading.value = true
    error.value = null
    try {
      processes.value = await apiRequest<ProcessInfo[]>(`/api/devices/${enc(serial.value)}/processes`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load processes'
    } finally {
      loading.value = false
    }
  }

  const sorted = computed(() => {
    const list = [...processes.value]
    if (sortBy.value === 'cpu') list.sort((a, b) => b.cpuPct - a.cpuPct)
    else if (sortBy.value === 'memory') list.sort((a, b) => b.memBytes - a.memBytes)
    else if (sortBy.value === 'pid') list.sort((a, b) => a.pid - b.pid)
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  })

  const filtered = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return sorted.value
    return sorted.value.filter((p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q))
  })

  async function kill(proc: ProcessInfo) {
    try {
      await apiRequest(`/api/devices/${enc(serial.value)}/processes/${proc.pid}`, { method: 'DELETE' })
      toast.success('Process killed', `${proc.name} (${proc.pid})`)
      await load()
    } catch (e) {
      toast.error('Kill failed', e instanceof Error ? e.message : undefined)
    }
  }

  watch(autoRefresh, (on) => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (on) {
      timer = setInterval(load, 5000)
    }
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return {
    processes,
    loading,
    error,
    search,
    autoRefresh,
    sortBy,
    sorted,
    filtered,
    load,
    kill,
  }
}