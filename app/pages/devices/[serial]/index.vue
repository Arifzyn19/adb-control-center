<script setup lang="ts">
import { BatteryMedium, Cpu, HardDrive, Info, MemoryStick, RefreshCw, Thermometer } from 'lucide-vue-next'
import { formatBytes, formatPercent, formatTemp, formatUptime } from '~/utils/format'
import type { DeviceDetail } from '../../../../shared/types'

const route = useRoute()
const serial = computed(() => String(route.params.serial))

const detail = ref<DeviceDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function loadDetail() {
  loading.value = true
  error.value = null
  try {
    detail.value = await apiRequest<DeviceDetail>(`/api/devices/${encodeURIComponent(serial.value)}/details`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load device details'
    detail.value = null
  } finally {
    loading.value = false
  }
}

onMounted(loadDetail)

const stats = computed(() => {
  const d = detail.value
  return [
    {
      label: 'Battery',
      value: formatPercent(d?.batteryPercent),
      icon: BatteryMedium,
      sub: d?.batteryTempC != null ? formatTemp(d.batteryTempC) : undefined,
    },
    {
      label: 'Memory',
      value: d ? `${formatBytes(d.ramUsedBytes)} / ${formatBytes(d.ramTotalBytes)}` : '—',
      icon: MemoryStick,
    },
    {
      label: 'Storage',
      value: d ? `${formatBytes(d.storageUsedBytes)} / ${formatBytes(d.storageTotalBytes)}` : '—',
      icon: HardDrive,
    },
    { label: 'CPU', value: d ? `${d.cpuCores} cores` : '—', icon: Cpu, sub: d?.cpuUsagePct != null ? `${d.cpuUsagePct}% used` : undefined },
  ]
})

const infoRows = computed(() => {
  const d = detail.value
  if (!d) return []
  const rows: [string, string][] = [
    ['Manufacturer', d.manufacturer],
    ['Model', d.model],
    ['Android version', d.androidVersion],
    ['SDK version', d.sdkVersion != null ? String(d.sdkVersion) : '—'],
    ['Build fingerprint', d.buildFingerprint || '—'],
    ['Serial number', d.serial],
    ['ABI', d.abi.join(', ')],
    ['CPU info', d.cpu],
    ['Kernel version', d.kernelVersion || '—'],
    ['RAM', formatBytes(d.ramTotalBytes)],
    ['Storage', formatBytes(d.storageTotalBytes)],
    ['Battery', formatPercent(d.batteryPercent)],
    ['Battery temp', formatTemp(d.batteryTempC)],
    ['Battery health', d.batteryHealth],
    ['IP address', d.ipAddress || '—'],
    ['Connection type', d.connectionType],
    ['Authorization', d.authorized ? 'Authorized' : 'Not authorized'],
    ['Security patch', d.securityPatch || '—'],
    ['Bootloader', d.bootloader || '—'],
    ['Screen', d.screenResolution || '—'],
    ['Locale', d.locale || '—'],
    ['Timezone', d.timezone || '—'],
    ['Uptime', formatUptime(d.uptime)],
    ['Last seen', new Date(d.lastSeen).toLocaleString()],
  ]
  return rows
})
</script>

<template>
  <DeviceScaffold :serial="serial">
    <template #default>
      <div v-if="loading">
        <div class="flex justify-center py-16"><AppSpinner label="Loading device details…" /></div>
      </div>

      <EmptyState v-else-if="error" :title="error" description="The device may be offline or the connection was interrupted.">
        <button class="btn-primary" @click="loadDetail"><RefreshCw class="h-4 w-4" /> Retry</button>
      </EmptyState>

      <template v-else>
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div v-for="stat in stats" :key="stat.label" class="card p-4">
            <div class="flex items-center gap-2 text-neutral-500">
              <component :is="stat.icon" class="h-4 w-4" />
              <span class="text-xs">{{ stat.label }}</span>
            </div>
            <p class="mt-2 text-lg font-semibold text-neutral-100">{{ stat.value }}</p>
            <p v-if="stat.sub" class="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
              <Thermometer class="h-3 w-3" v-if="stat.label === 'Battery'" />
              {{ stat.sub }}
            </p>
          </div>
        </div>

        <div class="mt-6">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-300">
            <Info class="h-4 w-4 text-neutral-500" /> Device information
          </h2>
          <div class="card overflow-hidden">
            <div class="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <div v-for="[label, value] in infoRows" :key="label" class="flex items-start justify-between gap-4 border-b border-neutral-800/60 px-4 py-2.5">
                <span class="shrink-0 text-sm text-neutral-500">{{ label }}</span>
                <span class="break-all text-right font-mono text-sm text-neutral-200">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </DeviceScaffold>
</template>