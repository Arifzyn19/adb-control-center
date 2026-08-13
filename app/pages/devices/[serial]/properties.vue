<script setup lang="ts">
import { Copy, RefreshCw, Search } from 'lucide-vue-next'

const route = useRoute()
const serial = computed(() => String(route.params.serial))
const toast = useToast()

interface PropertyEntry {
  key: string
  value: string
}

const props = ref<PropertyEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const filter = ref<'all' | 'has-value' | 'empty'>('all')

async function load() {
  loading.value = true
  error.value = null
  try {
    props.value = await apiRequest<PropertyEntry[]>(`/api/devices/${encodeURIComponent(serial.value)}/properties`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load properties'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => {
  let list = props.value
  if (filter.value === 'has-value') list = list.filter((p) => p.value)
  else if (filter.value === 'empty') list = list.filter((p) => !p.value)
  const q = search.value.toLowerCase()
  if (q) list = list.filter((p) => p.key.toLowerCase().includes(q) || p.value.toLowerCase().includes(q))
  return list
})

async function copyValue(p: PropertyEntry) {
  await navigator.clipboard.writeText(`${p.key}=${p.value}`)
  toast.success('Copied', p.key)
}
</script>

<template>
  <DeviceScaffold :serial="serial" title="Properties">
    <template #default>
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <div class="relative">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input v-model="search" class="input !pl-8" placeholder="Search properties…" />
        </div>
        <div class="flex rounded-lg border border-neutral-800 p-0.5">
          <button
            v-for="f in ['all', 'has-value', 'empty'] as const"
            :key="f"
            class="rounded-md px-3 py-1 text-xs font-medium capitalize"
            :class="filter === f ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'"
            @click="filter = f"
          >
            {{ f.replace('-', ' ') }}
          </button>
        </div>
        <button class="btn ml-auto" :disabled="loading" @click="load">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" /> Refresh
        </button>
      </div>

      <EmptyState v-if="loading" title="Loading properties…" />
      <EmptyState v-else-if="error" :title="error" />
      <EmptyState v-else-if="filtered.length === 0" title="No properties match" />

      <div v-else class="card divide-y divide-neutral-800/60">
        <div v-for="p in filtered" :key="p.key" class="group flex items-center gap-4 px-3 py-2 hover:bg-neutral-900/40">
          <span class="w-1/2 shrink-0 truncate font-mono text-xs text-sky-400/90">{{ p.key }}</span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-neutral-300">{{ p.value }}</span>
          <button
            class="text-neutral-500 opacity-0 transition-opacity hover:text-neutral-300 group-hover:opacity-100"
            title="Copy"
            @click="copyValue(p)"
          >
            <Copy class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </template>
  </DeviceScaffold>
</template>