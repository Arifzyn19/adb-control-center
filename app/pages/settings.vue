<script setup lang="ts">
import { LogOut, ShieldCheck, ShieldOff } from 'lucide-vue-next'

const auth = useAuth()
const toast = useToast()
const deviceManager = useDevices()

const serverInfo = ref<{
  adbPath?: string
  serverPort?: number
  adbVersion?: string
  platform?: string
  nodeVersion?: string
} | null>(null)

onMounted(async () => {
  try {
    serverInfo.value = await apiRequest('/api/info')
  } catch {
    /* optional */
  }
})

async function signOut() {
  await auth.logout()
  toast.success('Signed out')
}

const securityItems = [
  { label: 'Session authentication', value: 'Bearer token (required)', icon: ShieldCheck },
  { label: 'ADB path', value: serverInfo?.value?.adbPath || 'adb' },
  { label: 'ADB server port', value: serverInfo?.value?.serverPort != null ? String(serverInfo.value.serverPort) : '5037' },
  { label: 'Platform', value: serverInfo?.value?.platform || '—' },
  { label: 'Node version', value: serverInfo?.value?.nodeVersion || '—' },
  { label: 'ADB version', value: serverInfo?.value?.adbVersion || '—' },
]
</script>

<template>
  <div class="mx-auto max-w-3xl p-6">
    <h1 class="text-xl font-semibold text-neutral-100">Settings</h1>
    <p class="mt-0.5 text-sm text-neutral-500">Server and session settings.</p>

    <div class="mt-6">
      <h2 class="mb-3 text-sm font-medium text-neutral-300">Server</h2>
      <div class="card divide-y divide-neutral-800">
        <div v-for="item in securityItems" :key="item.label" class="flex items-center justify-between px-4 py-3">
          <span class="flex items-center gap-2 text-sm text-neutral-400">
            <component :is="item.icon" class="h-4 w-4 text-neutral-500" /> {{ item.label }}
          </span>
          <span class="font-mono text-sm text-neutral-200">{{ item.value }}</span>
        </div>
      </div>
    </div>

    <div class="mt-6">
      <h2 class="mb-3 text-sm font-medium text-neutral-300">Session</h2>
      <div class="card flex items-center justify-between px-4 py-3">
        <span class="flex items-center gap-2 text-sm text-neutral-400">
          <ShieldOff class="h-4 w-4 text-neutral-500" /> Current session
        </span>
        <button class="btn-danger" @click="signOut"><LogOut class="h-4 w-4" /> Sign out</button>
      </div>
    </div>

    <p class="mt-8 text-xs text-neutral-600">
      ADB Control Center runs the adb server on this machine. Devices are controlled over HTTP and WebSocket — the browser never talks to adb directly.
    </p>
  </div>
</template>