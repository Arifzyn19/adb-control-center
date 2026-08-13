<script setup lang="ts">
import { AppWindow, Cpu, FolderOpen, LayoutGrid, MonitorSmartphone, Plug, ScrollText, Server, Settings, SlidersHorizontal, SquareTerminal, X } from 'lucide-vue-next'
import type { DeviceInfo } from '../../../shared/types'

const props = defineProps<{
  devices: DeviceInfo[]
  selectedSerial: string | null
  collapsed: boolean
  mobileOpen: boolean
}>()

const emit = defineEmits<{
  toggle: []
  select: [serial: string]
  closeMobile: []
}>()

const route = useRoute()
const router = useRouter()

const sections = computed(() => {
  const devicePath = (suffix = '') => {
    if (!props.selectedSerial) return '/devices'
    return `/devices/${encodeURIComponent(props.selectedSerial)}${suffix}`
  }
  return [
    {
      id: 'management',
      label: 'MANAGEMENT',
      items: [
        { label: 'Apps', icon: AppWindow, to: devicePath('/apps') },
        { label: 'Logcat', icon: ScrollText, to: devicePath('/logcat') },
        { label: 'Terminal', icon: SquareTerminal, to: devicePath('/terminal') },
        { label: 'Files', icon: FolderOpen, to: devicePath('/files') },
        { label: 'Screen', icon: MonitorSmartphone, to: devicePath('/screen') },
      ],
    },
    {
      id: 'system',
      label: 'SYSTEM',
      items: [
        { label: 'Processes', icon: Cpu, to: devicePath('/processes') },
        { label: 'Services', icon: Server, to: devicePath('/services') },
        { label: 'Properties', icon: SlidersHorizontal, to: devicePath('/properties') },
      ],
    },
  ]
})

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <!-- Mobile backdrop -->
  <Teleport to="body">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-[80] bg-black/60 md:hidden"
      @click="emit('closeMobile')"
    />
  </Teleport>

  <aside
    :class="[
      'flex h-full flex-col border-r border-neutral-800 bg-neutral-950/90 transition-[width,transform] duration-150',
      'fixed left-0 top-0 z-[90] md:static',
      'md:translate-x-0',
      mobileOpen ? 'translate-x-0 shadow-2xl shadow-black/60' : '-translate-x-full',
      collapsed ? 'md:w-14' : 'md:w-60',
      'w-60',
    ]"
  >
    <div class="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-800 px-3">
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent"
        title="Overview"
        @click="router.push('/'); emit('closeMobile')"
      >
        <LayoutGrid class="h-4 w-4" />
      </button>
      <span v-if="!collapsed" class="truncate text-sm font-semibold tracking-wide text-neutral-100">ADB CONTROL</span>
      <button
        class="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 md:hidden"
        title="Close menu"
        @click="emit('closeMobile')"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto overflow-x-hidden py-3">
      <div class="mb-2 px-2">
        <button
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
          :class="{ 'bg-neutral-900 text-white': isActive('/') }"
          @click="router.push('/'); emit('closeMobile')"
        >
          <LayoutGrid class="h-4 w-4 shrink-0 text-neutral-500" />
          <span v-if="!collapsed">Overview</span>
        </button>
      </div>

      <div v-if="!collapsed" class="mb-2 flex items-center justify-between px-3">
        <span class="text-[11px] font-medium tracking-widest text-neutral-500">DEVICES</span>
        <button class="text-neutral-500 hover:text-neutral-300" title="Add device" @click="router.push('/devices?add=1'); emit('closeMobile')">
          <Plug class="h-3.5 w-3.5" />
        </button>
      </div>

      <div class="mb-3 space-y-0.5 px-2">
        <button
          v-for="device in devices"
          :key="device.serial"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-900"
          :class="device.serial === selectedSerial ? 'bg-neutral-900 text-white' : 'text-neutral-300'"
          @click="emit('select', device.serial)"
        >
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full"
            :class="device.status === 'connected' ? 'bg-emerald-500' : device.status === 'unauthorized' ? 'bg-yellow-500' : 'bg-neutral-600'"
          />
          <span v-if="!collapsed" class="truncate">{{ device.name }}</span>
        </button>
      </div>

      <template v-for="section in sections" :key="section.id">
        <div v-if="!collapsed" class="mb-1 px-3 text-[11px] font-medium tracking-widest text-neutral-500">
          {{ section.label }}
        </div>
        <div class="mb-3 space-y-0.5 px-2">
          <button
            v-for="item in section.items"
            :key="item.label"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-neutral-900"
            :class="isActive(item.to) ? 'bg-neutral-900 text-white' : 'text-neutral-300'"
            @click="router.push(item.to); emit('closeMobile')"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0 text-neutral-500" />
            <span v-if="!collapsed">{{ item.label }}</span>
          </button>
        </div>
      </template>
    </div>

    <div class="shrink-0 border-t border-neutral-800 p-3">
      <button
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
        :class="{ 'bg-neutral-900 text-white': isActive('/settings') }"
        @click="router.push('/settings'); emit('closeMobile')"
      >
        <Settings class="h-4 w-4 shrink-0 text-neutral-500" />
        <span v-if="!collapsed">Settings</span>
      </button>
    </div>
  </aside>
</template>