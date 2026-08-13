<script setup lang="ts">
const auth = useAuth()
const devices = useDevices()
const router = useRouter()

const sidebarCollapsed = useState('sidebar-collapsed', () => false)
const addDeviceOpen = useState('add-device-open', () => false)

const deviceList = computed(() => devices.devices.value)
const selectedSerial = computed(() => devices.selectedSerial.value)
const needsAuth = computed(() => !auth.authenticated.value)

async function ensureAuth() {
  if (auth.token.value) {
    await auth.check()
  }
}

onMounted(() => {
  ensureAuth()
  if (auth.authenticated.value) devices.start()
})

watch(auth.authenticated, (on) => {
  if (on) devices.start()
})

function selectDevice(serial: string) {
  devices.select(serial)
  router.push(`/devices/${encodeURIComponent(serial)}`)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar
      :devices="deviceList"
      :selected-serial="selectedSerial"
      :collapsed="sidebarCollapsed"
      @select="selectDevice"
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopbar
        :collapsed="sidebarCollapsed"
        @toggle="sidebarCollapsed = !sidebarCollapsed"
        @open-pair="addDeviceOpen = true"
      />

      <main class="min-h-0 flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>

    <AddDeviceModal v-if="addDeviceOpen" @close="addDeviceOpen = false" />
    <ToastHost />
    <ConfirmDialog />

    <div v-if="needsAuth" class="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950">
      <LoginScreen />
    </div>
  </div>
</template>