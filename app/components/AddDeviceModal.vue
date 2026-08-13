<script setup lang="ts">
import { toDataURL } from 'qrcode'
import { Check, Loader2, QrCode, RefreshCw, Smartphone, X } from 'lucide-vue-next'

const emit = defineEmits<{ close: [] }>()

const devices = useDevices()
const toast = useToast()
const router = useRouter()

const tab = ref<'qr' | 'manual'>('qr')
const starting = ref(false)
const session = ref<{ id: string; qrPayload: string; status: string } | null>(null)
const qrDataUrl = ref<string | null>(null)
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
const error = ref<string | null>(null)
const pairedDevice = ref<{ name: string; serial: string } | null>(null)

// manual
const manualAddress = ref('')
const manualCode = ref('')
const manualLoading = ref(false)

const steps = computed(() => {
  const status = session.value?.status
  return [
    { label: 'ADB server ready', done: true },
    { label: 'Waiting for pairing', done: status === 'paired' || status === 'connecting' || status === 'connected' },
    { label: 'Device paired', done: status === 'paired' || status === 'connecting' || status === 'connected' },
    { label: 'Device connected', done: status === 'connected' },
  ]
})

async function startPairing() {
  if (starting.value) return
  starting.value = true
  error.value = null
  try {
    const data = await apiRequest<{ id: string; qrPayload: string; status: string }>('/api/devices/pairing', { method: 'POST' })
    session.value = data
    qrDataUrl.value = await toDataURL(data.qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    })
    startPolling()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to start pairing'
  } finally {
    starting.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer.value = setInterval(async () => {
    if (!session.value) return
    try {
      const data = await apiRequest<{ status: string; error?: string; device?: { name: string; serial: string } }>(
        `/api/devices/pairing/${session.value.id}`,
      )
      session.value.status = data.status
      if (data.error) error.value = data.error
      if (data.device) pairedDevice.value = data.device
      if (data.status === 'connected') {
        stopPolling()
        toast.success('Device paired and connected', data.device?.name)
        await devices.refresh()
      } else if (data.status === 'failed') {
        stopPolling()
      }
    } catch {
      stopPolling()
    }
  }, 1500)
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function cancel() {
  if (session.value) {
    try {
      await apiRequest(`/api/devices/pairing/${session.value.id}`, { method: 'DELETE' })
    } catch {
      /* ignore */
    }
  }
  stopPolling()
  emit('close')
}

async function manualPair() {
  if (!manualAddress.value || !manualCode.value) return
  manualLoading.value = true
  error.value = null
  try {
    const res = await apiRequest<{ serial: string; status: string }>('/api/devices/pair-manual', {
      method: 'POST',
      body: JSON.stringify({ address: manualAddress.value, code: manualCode.value }),
    })
    toast.success('Device paired and connected', res.serial)
    await devices.refresh()
    emit('close')
    router.push(`/devices/${encodeURIComponent(res.serial)}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Pairing failed'
  } finally {
    manualLoading.value = false
  }
}

onBeforeUnmount(() => stopPolling())

function openDevice() {
  if (!pairedDevice.value) return
  emit('close')
  router.push(`/devices/${encodeURIComponent(pairedDevice.value.serial)}`)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" @click.self="cancel">
      <div class="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/50">
        <div class="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <h2 class="text-sm font-semibold text-neutral-100">Add Device</h2>
          <button class="text-neutral-500 hover:text-neutral-300" @click="cancel"><X class="h-4 w-4" /></button>
        </div>

        <div class="flex gap-1 border-b border-neutral-800 px-4 py-2">
          <button
            class="rounded-lg px-3 py-1.5 text-sm font-medium"
            :class="tab === 'qr' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'"
            @click="tab = 'qr'"
          >
            <span class="inline-flex items-center gap-1.5"><QrCode class="h-4 w-4" /> QR Pairing</span>
          </button>
          <button
            class="rounded-lg px-3 py-1.5 text-sm font-medium"
            :class="tab === 'manual' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'"
            @click="tab = 'manual'"
          >
            <span class="inline-flex items-center gap-1.5"><Smartphone class="h-4 w-4" /> Manual</span>
          </button>
        </div>

        <div class="p-5">
          <template v-if="tab === 'qr'">
            <template v-if="!session">
              <div class="mb-4 rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
                <p class="text-sm text-neutral-200">Connect Android Device</p>
                <p class="mt-1 text-xs text-neutral-500">
                  Enable <span class="text-neutral-300">Wireless debugging</span> on your device, then use
                  <span class="text-neutral-300">Pair device with QR code</span>.
                </p>
              </div>
              <p v-if="error" class="mb-3 text-sm text-red-400">{{ error }}</p>
              <button class="btn-primary w-full" :disabled="starting" @click="startPairing">
                <Loader2 v-if="starting" class="h-4 w-4 animate-spin" />
                <QrCode v-else class="h-4 w-4" />
                Start QR Pairing
              </button>
            </template>

            <template v-else-if="session.status !== 'connected'">
              <div class="flex flex-col items-center">
                <p class="mb-1 text-sm font-medium text-neutral-200">Scan this QR code from</p>
                <p class="mb-4 text-xs text-neutral-500">Android Wireless Debugging</p>
                <div class="rounded-xl border border-neutral-700 bg-white p-3">
                  <img v-if="qrDataUrl" :src="qrDataUrl" alt="Pairing QR code" class="h-48 w-48" />
                  <Loader2 v-else class="h-12 w-12 animate-spin text-neutral-400" />
                </div>
                <div class="mt-5 w-full space-y-1.5">
                  <div v-for="step in steps" :key="step.label" class="flex items-center gap-2 text-sm">
                    <Check v-if="step.done" class="h-4 w-4 text-emerald-400" />
                    <Loader2 v-else class="h-4 w-4 animate-spin text-neutral-600" />
                    <span :class="step.done ? 'text-neutral-300' : 'text-neutral-500'">{{ step.label }}</span>
                  </div>
                </div>
                <p v-if="error" class="mt-3 text-center text-sm text-red-400">{{ error }}</p>
                <div class="mt-5 flex gap-2">
                  <button class="btn-ghost" @click="cancel">Cancel</button>
                  <button class="btn" @click="stopPolling; startPairing()">
                    <RefreshCw class="h-3.5 w-3.5" /> Restart
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="flex flex-col items-center py-4">
                <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <Check class="h-6 w-6" />
                </div>
                <p class="text-sm font-semibold text-neutral-100">{{ pairedDevice?.name || 'Device connected' }}</p>
                <p class="mt-1 text-xs text-neutral-500">{{ pairedDevice?.serial }}</p>
                <button class="btn-primary mt-5 w-full" @click="openDevice">Open Device</button>
              </div>
            </template>
          </template>

          <template v-else>
            <div class="space-y-3">
              <div>
                <label class="label">Device address</label>
                <input v-model="manualAddress" class="input mono" placeholder="192.168.1.20:37043" />
              </div>
              <div>
                <label class="label">Pairing code</label>
                <input v-model="manualCode" class="input mono" placeholder="123456" />
              </div>
              <p class="text-xs text-neutral-500">
                Enter the IP:port and 6-digit code shown under
                <span class="text-neutral-300">Wireless debugging → Pair device with pairing code</span>.
              </p>
              <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
              <button class="btn-primary w-full" :disabled="manualLoading || !manualAddress || !manualCode" @click="manualPair">
                <Loader2 v-if="manualLoading" class="h-4 w-4 animate-spin" />
                Pair and Connect
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>