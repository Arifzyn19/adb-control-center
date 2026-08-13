<script setup lang="ts">
import { Camera, Download, RefreshCw, RotateCcw } from 'lucide-vue-next'

const route = useRoute()
const serial = computed(() => String(route.params.serial))
const toast = useToast()

const imgUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const autoRefresh = ref(false)
const autoScale = ref(true)
let timer: ReturnType<typeof setInterval> | null = null

const url = () => `/api/devices/${encodeURIComponent(serial.value)}/screenshot?t=${Date.now()}`

async function capture() {
  loading.value = true
  error.value = null
  try {
    const blob = await $fetch<Blob>(url(), { headers: authHeaders(), responseType: 'blob' })
    if (imgUrl.value) URL.revokeObjectURL(imgUrl.value)
    imgUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to capture screenshot'
  } finally {
    loading.value = false
  }
}

function download() {
  if (!imgUrl.value) return
  const a = document.createElement('a')
  a.href = imgUrl.value
  a.download = `screenshot-${serial.value}-${Date.now()}.png`
  a.click()
}

function rotate() {
  if (!imgUrl.value) return
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalHeight
    canvas.height = img.naturalWidth
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((90 * Math.PI) / 180)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    if (imgUrl.value) URL.revokeObjectURL(imgUrl.value)
    imgUrl.value = canvas.toDataURL('image/png')
  }
  img.src = imgUrl.value
}

watch(autoRefresh, (on) => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (on) {
    capture()
    timer = setInterval(capture, 3000)
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (imgUrl.value) URL.revokeObjectURL(imgUrl.value)
})

onMounted(capture)
</script>

<template>
  <DeviceScaffold :serial="serial" title="Screen">
    <template #default>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button class="btn-primary !py-1 text-xs" :disabled="loading" @click="capture">
          <Camera :class="['h-3.5 w-3.5', loading && 'animate-pulse']" /> Capture
        </button>
        <button class="btn !py-1 text-xs" :disabled="!imgUrl" @click="download"><Download class="h-3.5 w-3.5" /> Save</button>
        <button class="btn !py-1 text-xs" :disabled="!imgUrl" @click="rotate"><RotateCcw class="h-3.5 w-3.5" /> Rotate</button>
        <label class="ml-auto inline-flex items-center gap-1.5 text-sm text-neutral-400">
          <input v-model="autoRefresh" type="checkbox" class="accent-accent" /> Auto-refresh (3s)
        </label>
        <label class="inline-flex items-center gap-1.5 text-sm text-neutral-400">
          <input v-model="autoScale" type="checkbox" class="accent-accent" /> Fit to screen
        </label>
      </div>

      <div
        class="card flex min-h-[480px] items-center justify-center overflow-auto bg-[repeating-conic-gradient(#111111_0%_25%,#0a0a0a_0%_50%)] bg-[length:24px_24px] p-4"
      >
        <EmptyState v-if="!imgUrl && !loading && !error" title="No screenshot yet" description="Capture the device screen to get started." />

        <img
          v-if="imgUrl"
          :src="imgUrl"
          class="rounded-lg border border-neutral-800 shadow-2xl shadow-black/60"
          :class="autoScale ? 'max-h-[75vh] max-w-full object-contain' : ''"
          alt="Device screen"
        />

        <div v-if="error" class="text-sm text-red-400">{{ error }}</div>
        <AppSpinner v-if="loading && !imgUrl" label="Capturing…" />
      </div>
    </template>
  </DeviceScaffold>
</template>