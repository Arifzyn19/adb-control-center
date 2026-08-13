import type { AppInfo } from '../../shared/types'

export function useApps(serial: Ref<string | null | undefined>) {
  const toast = useToast()
  const apps = ref<AppInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const search = ref('')
  const type = ref<'all' | 'user' | 'system'>('all')
  const sort = ref<'label' | 'package'>('label')
  const selected = ref<AppInfo | null>(null)

  const enc = (s: string | null | undefined) => (s ? encodeURIComponent(s) : '')
  const base = () => `/api/devices/${enc(serial.value)}/apps`

  async function load() {
    if (!serial.value) return
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams({ type: type.value, sort: sort.value, search: search.value })
      apps.value = await apiRequest<AppInfo[]>(`${base()}?${params}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load apps'
    } finally {
      loading.value = false
    }
  }

  const filteredApps = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return apps.value
    return apps.value.filter((a) => a.label.toLowerCase().includes(q) || a.package.toLowerCase().includes(q))
  })

  async function openDetails(app: AppInfo) {
    try {
      selected.value = await apiRequest<AppInfo>(`${base()}/${encodeURIComponent(app.package)}`)
    } catch (e) {
      toast.error('Failed to load app details', e instanceof Error ? e.message : undefined)
    }
  }

  async function launch(app: AppInfo) {
    try {
      await apiRequest(`${base()}/launch`, { method: 'POST', body: JSON.stringify({ package: app.package }) })
      toast.success('App launched', app.label)
    } catch (e) {
      toast.error('Launch failed', e instanceof Error ? e.message : undefined)
    }
  }

  async function forceStop(app: AppInfo) {
    try {
      await apiRequest(`${base()}/force-stop`, { method: 'POST', body: JSON.stringify({ package: app.package }) })
      toast.success('App stopped', app.label)
    } catch (e) {
      toast.error('Failed to stop app', e instanceof Error ? e.message : undefined)
    }
  }

  async function uninstall(app: AppInfo) {
    try {
      await apiRequest(`${base()}/uninstall`, { method: 'POST', body: JSON.stringify({ package: app.package }) })
      toast.success('App uninstalled', app.label)
      await load()
      if (selected.value?.package === app.package) selected.value = null
    } catch (e) {
      toast.error('Uninstall failed', e instanceof Error ? e.message : undefined)
    }
  }

  async function clear(target: 'data' | 'cache', app: AppInfo) {
    try {
      await apiRequest(`${base()}/clear`, { method: 'POST', body: JSON.stringify({ package: app.package, target }) })
      toast.success(target === 'data' ? 'App data cleared' : 'Cache cleared', app.label)
    } catch (e) {
      toast.error('Clear failed', e instanceof Error ? e.message : undefined)
    }
  }

  async function setEnabled(app: AppInfo, enabled: boolean) {
    try {
      await apiRequest(`${base()}/enable`, { method: 'POST', body: JSON.stringify({ package: app.package, enabled }) })
      toast.success(enabled ? 'App enabled' : 'App disabled', app.label)
      const idx = apps.value.findIndex((a) => a.package === app.package)
      const current = apps.value[idx]
      if (current) current.isEnabled = enabled
      if (selected.value?.package === app.package && selected.value) selected.value.isEnabled = enabled
    } catch (e) {
      toast.error('Operation failed', e instanceof Error ? e.message : undefined)
    }
  }

  async function reinstall(app: AppInfo) {
    try {
      await apiRequest(`${base()}/reinstall`, { method: 'POST' })
      toast.success('App reinstalled', app.label)
    } catch (e) {
      toast.error('Reinstall failed', e instanceof Error ? e.message : undefined)
    }
  }

  function extract(app: AppInfo) {
    window.location.href = `${base()}/extract?package=${encodeURIComponent(app.package)}&token=${useAuth().token.value || ''}`
  }

  async function install(file: File, opts: { replace?: boolean; grant?: boolean } = {}) {
    if (!serial.value) return
    const form = new FormData()
    form.append('file', file)
    form.append('replace', String(opts.replace ?? true))
    form.append('grant', String(opts.grant ?? true))
    try {
      await apiRequest(`${base()}/install`, { method: 'POST', body: form })
      toast.success('APK installed', file.name)
      await load()
    } catch (e) {
      toast.error('Install failed', e instanceof Error ? e.message : undefined)
    }
  }

  return {
    apps,
    filteredApps,
    loading,
    error,
    search,
    type,
    sort,
    selected,
    load,
    openDetails,
    launch,
    forceStop,
    uninstall,
    clear,
    setEnabled,
    reinstall,
    extract,
    install,
  }
}