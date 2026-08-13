<script setup lang="ts">
import { ArrowUpRight, BatteryMedium, HardDrive, MemoryStick, RefreshCw, Smartphone } from 'lucide-vue-next'
import { formatBytes, formatPercent, relativeTime } from '~/utils/format'
import type { DeviceInfo } from '../../shared/types'

const devices = useDevices()
const router = useRouter()

const stats = ref<{
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  logEvents: number
  activeLogcatSessions: number
  recentlyConnected: DeviceInfo[]
} | null>(null)
const loading = ref(true)

async function loadStats() {
  loading.value = true
  try {
    stats.value = await apiRequest('/api/stats')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  devices.start()
  await Promise.all([devices.refresh().catch(() => {}), loadStats()])
})

const statCards = computed(() => [
  { label: 'Total devices', value: stats.value?.totalDevices ?? devices.devices.value.length, icon: Smartphone },
  { label: 'Online', value: stats.value?.onlineDevices ?? devices.onlineCount.value, icon: null, accent: 'text-emerald-400' },
  { label: 'Offline', value: stats.value?.offlineDevices ?? devices.offlineCount.value, icon: null, accent: 'text-red-400' },
  { label: 'Log events buffered', value: stats.value?.logEvents ?? 0, icon: null },
])

function batteryColor(p: number | null) {
  if (p === null) return 'text-neutral-500'
  if (p > 50) return 'text-emerald-400'
  if (p > 20) return 'text-yellow-400'
  return 'text-red-400'
}
</script>

<template>
  <div class="mx-auto max-w-6xl p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-neutral-100">Overview</h1>
        <p class="mt-0.5 text-sm text-neutral-500">Manage your Android devices over wireless ADB.</p>
      </div>
      <button class="btn" :disabled="loading" @click="loadStats">
        <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" /> Refresh
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div v-for="card in statCards" :key="card.label" class="card p-4">
        <p class="text-xs text-neutral-500">{{ card.label }}</p>
        <p class="mt-1 text-2xl font-semibold" :class="card.accent || 'text-neutral-100'">{{ card.value }}</p>
      </div>
    </div>

    <div class="mt-8">
      <h2 class="mb-3 text-sm font-medium text-neutral-300">Devices</h2>
      <EmptyState
        v-if="!loading && devices.devices.value.length === 0"
        title="No devices connected"
        description="Add a device using wireless ADB QR pairing to get started."
      >
        <button class="btn-primary" @click="router.push('/devices?add=1')">Add Device</button>
      </EmptyState>

      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="device in devices.devices.value"
          :key="device.serial"
          class="card cursor-pointer p-4 transition-colors hover:border-neutral-700"
          @click="router.push(`/devices/${encodeURIComponent(device.serial)}`)"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-neutral-100">{{ device.name }}</p>
              <p class="mt-0.5 text-xs text-neutral-500">Android {{ device.androidVersion }} · {{ device.connectionType }}</p>
            </div>
            <StatusDot :status="device.status" />
          </div>

          <div class="mt-4 space-y-1.5">
            <div class="flex items-center gap-2 text-xs">
              <BatteryMedium class="h-3.5 w-3.5 text-neutral-500" />
              <span :class="batteryColor(device.batteryPercent)">{{ formatPercent(device.batteryPercent) }}</span>
              <span class="text-neutral-600">·</span>
              <span class="text-neutral-400">{{ relativeTime(device.lastConnected) }}</span>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <MemoryStick class="h-3.5 w-3.5 text-neutral-500" />
              <span class="text-neutral-400">{{ formatBytes(device.ramTotalBytes) }} RAM</span>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <HardDrive class="h-3.5 w-3.5 text-neutral-500" />
              <span class="text-neutral-400">{{ formatBytes(device.storageTotalBytes) }} storage</span>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between border-t border-neutral-800 pt-3">
            <button
              class="btn-primary !px-3 !py-1 text-xs"
              @click.stop="router.push(`/devices/${encodeURIComponent(device.serial)}`)"
            >
              Open Device <ArrowUpRight class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="stats?.recentlyConnected?.length" class="mt-8">
      <h2 class="mb-3 text-sm font-medium text-neutral-300">Recently connected</h2>
      <div class="card divide-y divide-neutral-800">
        <div v-for="device in stats.recentlyConnected" :key="device.serial" class="flex items-center gap-3 px-4 py-3">
          <span
            class="h-2 w-2 rounded-full"
            :class="device.status === 'connected' ? 'bg-emerald-500' : 'bg-neutral-600'"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-neutral-100">{{ device.name }}</p>
            <p class="truncate text-xs text-neutral-500">{{ device.serial }}</p>
          </div>
          <span class="text-xs text-neutral-500">{{ relativeTime(device.lastConnected) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>