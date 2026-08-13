<script setup lang="ts">
import { RefreshCw, Search, Skull } from 'lucide-vue-next'
import { formatBytes, formatPercent } from '~/utils/format'
import type { ProcessInfo } from '../../../../shared/types'

const route = useRoute()
const serial = computed(() => String(route.params.serial))
const processes = useProcesses(serial)
const confirm = useConfirm()

onMounted(() => processes.load())

async function doKill(proc: ProcessInfo) {
  const ok = await confirm.confirm({
    title: `Kill process ${proc.pid}?`,
    message: `${proc.name} will be terminated. The system may restart it automatically.`,
    confirmLabel: 'Kill',
    destructive: true,
  })
  if (ok) await processes.kill(proc)
}
</script>

<template>
  <DeviceScaffold :serial="serial" title="Processes">
    <template #default>
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <div class="relative">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input v-model="processes.search.value" class="input !pl-8" placeholder="Search processes…" />
        </div>
        <select v-model="processes.sortBy.value" class="input !w-auto">
          <option value="cpu">Sort by CPU</option>
          <option value="memory">Sort by memory</option>
          <option value="pid">Sort by PID</option>
          <option value="name">Sort by name</option>
        </select>
        <label class="inline-flex items-center gap-1.5 text-sm text-neutral-400">
          <input v-model="processes.autoRefresh.value" type="checkbox" class="accent-accent" /> Auto-refresh (5s)
        </label>
        <button class="btn ml-auto" @click="processes.load()">
          <RefreshCw :class="['h-4 w-4', processes.loading.value && 'animate-spin']" /> Refresh
        </button>
      </div>

      <EmptyState v-if="processes.loading.value" title="Loading processes…" />
      <EmptyState v-else-if="processes.error.value" :title="processes.error.value" />
      <EmptyState v-else-if="processes.filtered.value.length === 0" title="No processes found" />

      <div v-else class="card overflow-hidden">
        <div class="flex border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-xs font-medium text-neutral-500">
          <span class="w-16 shrink-0">PID</span>
          <span class="w-14 shrink-0">USER</span>
          <span class="min-w-0 flex-1">Name</span>
          <span class="w-20 shrink-0 text-right">CPU</span>
          <span class="w-24 shrink-0 text-right">Memory</span>
          <span class="w-16 shrink-0 text-right">Actions</span>
        </div>
        <div class="divide-y divide-neutral-800/60">
          <div
            v-for="proc in processes.filtered.value"
            :key="proc.pid"
            class="group flex items-center px-4 py-2 hover:bg-neutral-900/40"
          >
            <span class="w-16 shrink-0 font-mono text-xs text-neutral-300">{{ proc.pid }}</span>
            <span class="w-14 shrink-0 truncate font-mono text-xs text-neutral-500">{{ proc.user }}</span>
            <span class="min-w-0 flex-1 truncate text-sm text-neutral-200">{{ proc.name }}</span>
            <span class="w-20 shrink-0 text-right font-mono text-xs" :class="proc.cpuPct > 50 ? 'text-red-400' : 'text-neutral-300'">
              {{ formatPercent(proc.cpuPct) }}
            </span>
            <span class="w-24 shrink-0 text-right font-mono text-xs text-neutral-300">
              {{ formatBytes(proc.memBytes) }}
            </span>
            <span class="w-16 shrink-0 text-right">
              <button
                class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-neutral-400 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                title="Kill process"
                @click="doKill(proc)"
              >
                <Skull class="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </template>
  </DeviceScaffold>
</template>