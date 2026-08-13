<script setup lang="ts">
import { ArrowLeft, MoreVertical, RefreshCw, Smartphone, Unplug } from 'lucide-vue-next'

const props = defineProps<{
  serial: string
  title?: string
}>()

const devices = useDevices()
const router = useRouter()
const toast = useToast()
const route = useRoute()

const device = computed(() => devices.getDevice(props.serial))
const menuOpen = ref(false)
let ws: WebSocket | null = null

onMounted(() => {
  devices.select(props.serial)
  devices.start()

  const token = useAuth().token.value
  if (!token) return
  ws = new WebSocket(wsUrl('/ws/device-status', { serial: props.serial }))
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string)
      if (msg.type === 'device' && msg.device) {
        const idx = devices.devices.value.findIndex((d) => d.serial === props.serial)
        if (idx !== -1) {
          const next = [...devices.devices.value]
          next[idx] = msg.device
          devices.devices.value = next
        } else {
          devices.devices.value = [...devices.devices.value, msg.device]
        }
      }
    } catch {
      /* ignore */
    }
  }
})

onBeforeUnmount(() => {
  ws?.close()
  ws = null
})

watch(
  () => device.value?.status,
  (now, prev) => {
    if (prev === 'connected' && now !== 'connected' && now !== undefined) {
      toast.warning('Device disconnected', `Connection to ${device.value?.name} was lost.`)
    }
  },
)

async function refresh() {
  try {
    await apiRequest(`/api/devices/${encodeURIComponent(props.serial)}/refresh`, { method: 'POST' })
    toast.success('Device refreshed')
  } catch (e) {
    toast.error('Refresh failed', e instanceof Error ? e.message : undefined)
  }
}

async function restartAdb() {
  menuOpen.value = false
  try {
    await devices.disconnect(props.serial)
    await new Promise((r) => setTimeout(r, 1500))
    await devices.connectDevice(props.serial)
    toast.success('ADB connection restarted')
  } catch (e) {
    toast.error('Restart failed', e instanceof Error ? e.message : undefined)
  }
}

async function disconnect() {
  menuOpen.value = false
  await devices.disconnect(props.serial)
}

async function reconnect() {
  try {
    await devices.connectDevice(props.serial)
  } catch (e) {
    toast.error('Reconnect failed', e instanceof Error ? e.message : undefined)
  }
}

const tabs = computed(() => {
  const base = `/devices/${encodeURIComponent(props.serial)}`
  return [
    { label: 'Overview', to: base },
    { label: 'Apps', to: `${base}/apps` },
    { label: 'Logcat', to: `${base}/logcat` },
    { label: 'Terminal', to: `${base}/terminal` },
    { label: 'Files', to: `${base}/files` },
    { label: 'Screen', to: `${base}/screen` },
    { label: 'Processes', to: `${base}/processes` },
    { label: 'Services', to: `${base}/services` },
    { label: 'Properties', to: `${base}/properties` },
  ]
})
</script>

<template>
  <div class="mx-auto max-w-6xl p-6">
    <div class="mb-6">
      <button class="mb-3 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300" @click="router.push('/devices')">
        <ArrowLeft class="h-3.5 w-3.5" /> Devices
      </button>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800/60 text-neutral-300">
            <Smartphone class="h-5 w-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-semibold text-neutral-100">{{ device?.name || serial }}</h1>
              <StatusDot :status="device?.status || 'disconnected'" />
            </div>
            <p class="text-xs text-neutral-500">
              {{ device?.model }} · Android {{ device?.androidVersion }} · {{ serial }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button v-if="device?.status !== 'connected'" class="btn-primary" @click="reconnect">
            <Unplug class="h-4 w-4" /> Reconnect
          </button>
          <button class="btn" @click="refresh"><RefreshCw class="h-4 w-4" /> Refresh</button>
          <div class="relative">
            <button class="btn-ghost h-9 w-9 !p-0" @click="menuOpen = !menuOpen">
              <MoreVertical class="h-4 w-4" />
            </button>
            <div
              v-if="menuOpen"
              class="absolute right-0 top-10 z-40 w-44 rounded-xl border border-neutral-800 bg-neutral-900 p-1.5 shadow-xl shadow-black/50"
              @click.self="menuOpen = false"
            >
              <button class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800" @click="restartAdb">
                Restart ADB
              </button>
              <button class="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10" @click="disconnect">
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="device?.status === 'unauthorized'" class="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
        This device requires ADB authorization. Accept the debugging prompt on the device, then refresh.
      </div>

      <nav class="mt-5 flex gap-1 overflow-x-auto border-b border-neutral-800">
        <button
          v-for="tab in tabs"
          :key="tab.to"
          class="shrink-0 border-b-2 px-3 py-2 text-sm transition-colors"
          :class="route.path === tab.to ? 'border-accent text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'"
          @click="router.push(tab.to)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <slot :device="device" />
  </div>
</template>