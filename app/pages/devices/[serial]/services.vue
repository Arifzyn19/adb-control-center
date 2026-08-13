<script setup lang="ts">
import { ChevronDown, RefreshCw } from 'lucide-vue-next'

const route = useRoute()
const serial = computed(() => String(route.params.serial))

interface ServiceSection {
  id: string
  title: string
  summary: { label: string; value: string }[]
  raw: string
}

const sections = ref<ServiceSection[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const expanded = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    sections.value = await apiRequest<ServiceSection[]>(`/api/devices/${encodeURIComponent(serial.value)}/services`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load system services'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <DeviceScaffold :serial="serial" title="Services">
    <template #default>
      <div class="mb-3 flex items-center gap-2">
        <button class="btn ml-auto" :disabled="loading" @click="load">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" /> Refresh
        </button>
      </div>

      <EmptyState v-if="loading" title="Reading system services…" description="Running dumpsys queries on the device." />
      <EmptyState v-else-if="error" :title="error" />
      <EmptyState v-else-if="sections.length === 0" title="No service data available" />

      <div v-else class="grid gap-3 lg:grid-cols-2">
        <div v-for="section in sections" :key="section.id" class="card flex flex-col p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-neutral-100">{{ section.title }}</h3>
            <button
              v-if="section.raw"
              class="btn-ghost h-6 w-6 !p-0 text-neutral-500"
              title="Toggle raw output"
              @click="expanded = expanded === section.id ? null : section.id"
            >
              <ChevronDown :class="['h-3.5 w-3.5 transition-transform', expanded === section.id && 'rotate-180']" />
            </button>
          </div>

          <div v-if="section.summary.length" class="space-y-1.5">
            <div
              v-for="item in section.summary"
              :key="item.label"
              class="flex items-center justify-between gap-4 rounded-lg bg-neutral-950/50 px-3 py-1.5"
            >
              <span class="truncate text-xs text-neutral-500">{{ item.label }}</span>
              <span class="break-all text-right font-mono text-xs text-neutral-200">{{ item.value }}</span>
            </div>
          </div>
          <p v-else class="text-xs text-neutral-600">No summary available.</p>

          <details v-if="expanded === section.id" class="mt-3">
            <pre class="max-h-64 overflow-auto rounded-lg bg-neutral-950/70 p-3 font-mono text-xs leading-5 text-neutral-400 whitespace-pre-wrap">{{ section.raw }}</pre>
          </details>
        </div>
      </div>
    </template>
  </DeviceScaffold>
</template>