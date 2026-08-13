import type { FileEntry } from '../../shared/types'

export function useFiles(serial: Ref<string | null | undefined>) {
  const toast = useToast()
  const path = ref('/sdcard')
  const parent = ref<string | null>(null)
  const entries = ref<FileEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const history: string[] = []

  const enc = (s: string | null | undefined) => (s ? encodeURIComponent(s) : '')
  const base = () => `/api/devices/${enc(serial.value)}/files`

  async function navigate(next: string) {
    if (next === path.value) return
    if (history[history.length - 1] !== path.value) history.push(path.value)
    path.value = next
    await load()
  }

  async function up() {
    const p = history.pop()
    if (p) {
      path.value = p
      await load()
    }
  }

  async function load() {
    if (!serial.value) return
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest<{ path: string; parent: string | null; entries: FileEntry[] }>(
        `${base()}?path=${encodeURIComponent(path.value)}`,
      )
      path.value = data.path
      parent.value = data.parent
      entries.value = data.entries
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to list directory'
    } finally {
      loading.value = false
    }
  }

  function openEntry(entry: FileEntry) {
    if (entry.type === 'dir') navigate(entry.path)
  }

  async function download(entry: FileEntry) {
    if (!serial.value) return
    window.location.href = `${base()}/download?path=${encodeURIComponent(entry.path)}&token=${useAuth().token.value || ''}`
  }

  async function upload(files: FileList | File[], toPath = path.value) {
    if (!serial.value || !files.length) return
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      form.append('path', toPath)
      try {
        await apiRequest(`${base()}/upload`, { method: 'POST', body: form })
        toast.success('File uploaded', file.name)
      } catch (e) {
        toast.error('Upload failed', e instanceof Error ? e.message : undefined)
      }
    }
    await load()
  }

  async function remove(entry: FileEntry) {
    try {
      await apiRequest(`${base()}/delete`, { method: 'POST', body: JSON.stringify({ path: entry.path }) })
      toast.success('Deleted', entry.name)
      await load()
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : undefined)
    }
  }

  async function rename(entry: FileEntry, newName: string) {
    const to = entry.path.split('/').slice(0, -1).concat(newName).join('/')
    try {
      await apiRequest(`${base()}/rename`, { method: 'POST', body: JSON.stringify({ from: entry.path, to }) })
      toast.success('Renamed', newName)
      await load()
    } catch (e) {
      toast.error('Rename failed', e instanceof Error ? e.message : undefined)
    }
  }

  async function mkdir(name: string) {
    const to = path.value === '/' ? `/${name}` : `${path.value}/${name}`
    try {
      await apiRequest(`${base()}/mkdir`, { method: 'POST', body: JSON.stringify({ path: to }) })
      toast.success('Directory created', name)
      await load()
    } catch (e) {
      toast.error('Create failed', e instanceof Error ? e.message : undefined)
    }
  }

  async function installApk(entry: FileEntry) {
    try {
      await apiRequest(`${base()}/install`, { method: 'POST', body: JSON.stringify({ path: entry.path }) })
      toast.success('APK installed', entry.name)
    } catch (e) {
      toast.error('Install failed', e instanceof Error ? e.message : undefined)
    }
  }

  return {
    path,
    parent,
    entries,
    loading,
    error,
    navigate,
    up,
    load,
    openEntry,
    download,
    upload,
    remove,
    rename,
    mkdir,
    installApk,
  }
}