<script setup lang="ts">
import { MoreVertical, Plus, RefreshCw, Smartphone, Trash2, Unplug } from 'lucide-vue-next'
import { formatBytes, relativeTime } from '~/utils/format'

const devices = useDevices()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const route = useRoute()
const search = ref('')
const filter = ref<'all' | 'online' | 'offline'>('all')
const loading = ref(false)
const menuFor = ref<string | null>(null)
const addDeviceOpen = useState('add-device-open', () => false)

onMounted(() => {
  devices.start()
  if (route.query.add === '1') addDeviceOpen.value = true
})

const filteredDevices = computed(() => {
  let list = devices.devices.value
  if (filter.value === 'online') list = list.filter((d) => d.status === 'connected')
  else if (filter.value === 'offline') list = list.filter((d) => d.status !== 'connected')
  const q = search.value.toLowerCase()
  if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.serial.toLowerCase().includes(q))
  return list
})

async function refresh() {
  loading.value = true
  try {
    await devices.refresh()
    toast.success('Devices refreshed')
  } catch (e) {
    toast.error('Refresh failed', e instanceof Error ? e.message : undefined)
  } finally {
    loading.value = false
  }
}

async function disconnect(serial: string) {
  menuFor.value = null
  await devices.disconnect(serial)
}

async function remove(serial: string) {
  menuFor.value = null
  const ok = await confirm.confirm({
    title: 'Remove device?',
    message: `Remove "${serial}" from the device list? This will disconnect it.`,
    confirmLabel: 'Remove',
    destructive: true,
  })
  if (ok) await devices.remove(serial)
}
</script>

<template>
  <div class="mx-auto max-w-6xl p-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-neutral-100">Devices</h1>
        <p class="mt-0.5 text-sm text-neutral-500">{{ devices.devices.value.length }} known devices</p>
      </div>
      <div class="flex gap-2">
        <button class="btn" :disabled="loading" @click="refresh">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" /> Refresh
        </button>
        <button class="btn-primary" @click="addDeviceOpen = true">
          <Plus class="h-4 w-4" /> Add Device
        </button>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input v-model="search" class="input w-64" placeholder="Search devices…" />
      <div class="flex rounded-lg border border-neutral-800 p-0.5">
        <button
          v-for="f in ['all', 'online', 'offline'] as const"
          :key="f"
          class="rounded-md px-3 py-1 text-xs font-medium capitalize"
          :class="filter === f ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'"
          @click="filter = f"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <EmptyState
      v-if="filteredDevices.length === 0"
      title="No devices found"
      description="Connect a device using wireless ADB to see it here."
    />

    <div v-else class="card divide-y divide-neutral-800">
      <div
        v-for="device in filteredDevices"
        :key="device.serial"
        class="group flex items-center gap-4 px-4 py-3 hover:bg-neutral-900/40"
      >
        <div class="flex min-w-0 flex-1 cursor-pointer items-center gap-3" @click="router.push(`/devices/${encodeURIComponent(device.serial)}`)">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800/60 text-neutral-400"
          >
            <Smartphone class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-neutral-100">{{ device.name }}</p>
            <p class="truncate text-xs text-neutral-500">
              {{ device.model }} · Android {{ device.androidVersion }} · {{ device.serial }}
            </p>
          </div>
        </div>

        <div class="hidden w-40 shrink-0 text-xs text-neutral-500 md:block">
          <p>{{ device.connectionType }} · IP {{ device.ipAddress || '—' }}</p>
          <p>RAM {{ formatBytes(device.ramTotalBytes) }} · Battery {{ formatPercent(device.batteryPercent) }}</p>
        </div>

        <div class="shrink-0">
          <StatusDot :status="device.status" />
        </div>

        <div class="relative shrink-0">
          <button class="btn-ghost h-8 w-8 !p-0" @click="menuFor = menuFor === device.serial ? null : device.serial">
            <MoreVertical class="h-4 w-4" />
          </button>
          <div
            v-if="menuFor === device.serial"
            class="absolute right-0 top-9 z-40 w-44 rounded-xl border border-neutral-800 bg-neutral-900 p-1.5 shadow-xl shadow-black/50"
            @click.self="menuFor = null"
          >
            <button
              v-if="device.status !== 'connected'"
              class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              @click="devices.connectDevice(device.serial).catch(() => {}); menuFor = null"
            >
              Reconnect
            </button>
            <button
              v-if="device.status === 'connected'"
              class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              @click="disconnect(device.serial)"
            >
              <span class="inline-flex items-center gap-2"><Unplug class="h-3.5 w-3.5" /> Disconnect</span>
            </button>
            <button
              class="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
              @click="remove(device.serial)"
            >
              <span class="inline-flex items-center gap-2"><Trash2 class="h-3.5 w-3.5" /> Remove device</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <AddDeviceModal v-if="addDeviceOpen" @close="addDeviceOpen = false" />
  </div>
</template>