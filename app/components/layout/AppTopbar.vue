<script setup lang="ts">
import { ChevronDown, Menu, Plus, Search, X } from 'lucide-vue-next'

const props = defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
  openPair: []
}>()

const router = useRouter()
const { devices, refresh } = useDevices()
const { logout } = useAuth()
const toast = useToast()

const query = ref('')
const searchOpen = ref(false)
const menuOpen = ref(false)
const searchRef = ref<HTMLInputElement | null>(null)

const filteredDevices = computed(() => {
  const q = query.value.toLowerCase()
  if (!q) return devices.value.slice(0, 6)
  return devices.value.filter((d) => d.name.toLowerCase().includes(q) || d.serial.toLowerCase().includes(q)).slice(0, 8)
})

watch(searchOpen, (open) => {
  if (open) nextTick(() => searchRef.value?.focus())
})

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    searchOpen.value = true
  }
  if (e.key === 'Escape') {
    searchOpen.value = false
    menuOpen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

async function onRefresh() {
  try {
    await refresh()
    toast.success('Devices refreshed')
  } catch (e) {
    toast.error('Refresh failed', e instanceof Error ? e.message : undefined)
  }
}

function goDevice(serial: string) {
  searchOpen.value = false
  query.value = ''
  router.push(`/devices/${encodeURIComponent(serial)}`)
}
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-950/90 px-3">
    <button class="btn-ghost h-8 w-8 !p-0" title="Toggle sidebar" @click="emit('toggle')">
      <Menu class="h-4 w-4" />
    </button>

    <button class="btn ml-1 hidden !py-1.5 sm:inline-flex" @click="emit('openPair')">
      <Plus class="h-4 w-4" />
      <span>Add Device</span>
    </button>

    <button
      class="ml-auto flex w-64 max-w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-700"
      @click="searchOpen = true"
    >
      <Search class="h-4 w-4" />
      <span class="flex-1 text-left">Search devices…</span>
      <span class="kbd">Ctrl K</span>
    </button>

    <div class="relative">
      <button class="btn-ghost h-8 w-8 !p-0" title="Menu" @click="menuOpen = !menuOpen">
        <ChevronDown class="h-4 w-4" />
      </button>
      <div
        v-if="menuOpen"
        class="absolute right-0 top-10 z-50 w-52 rounded-xl border border-neutral-800 bg-neutral-900 p-1.5 shadow-xl shadow-black/50"
        @click.self="menuOpen = false"
      >
        <button class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800" @click="router.push('/settings'); menuOpen = false">
          Settings
        </button>
        <button class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800" @click="onRefresh">
          Refresh devices
        </button>
        <div class="my-1 border-t border-neutral-800" />
        <button class="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10" @click="logout(); menuOpen = false">
          Sign out
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="searchOpen" class="fixed inset-0 z-[95] flex items-start justify-center bg-black/60 p-4 pt-24" @click.self="searchOpen = false">
        <div class="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/60">
          <div class="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
            <Search class="h-4 w-4 text-neutral-500" />
            <input
              ref="searchRef"
              v-model="query"
              class="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
              placeholder="Search devices by name or serial…"
            />
            <button class="text-neutral-500 hover:text-neutral-300" @click="searchOpen = false">
              <X class="h-4 w-4" />
            </button>
          </div>
          <div class="max-h-80 overflow-y-auto p-1.5">
            <EmptyState v-if="filteredDevices.length === 0" title="No devices found" description="Try a different search term." />
            <button
              v-for="device in filteredDevices"
              :key="device.serial"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-800"
              @click="goDevice(device.serial)"
            >
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="device.status === 'connected' ? 'bg-emerald-500' : 'bg-neutral-600'"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-neutral-100">{{ device.name }}</p>
                <p class="truncate text-xs text-neutral-500">{{ device.serial }}</p>
              </div>
              <StatusDot :status="device.status" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </header>
</template>