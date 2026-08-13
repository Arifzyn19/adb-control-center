<script setup lang="ts">
import { RefreshCw, Square } from 'lucide-vue-next'

const route = useRoute()
const serial = computed(() => String(route.params.serial))
const terminal = useTerminal(serial)
const toast = useToast()

function reconnect() {
  terminal.connected.value = false
  terminal.error.value = null
  setTimeout(() => terminal.connect(), 200)
}
</script>

<template>
  <DeviceScaffold :serial="serial" title="Terminal">
    <template #default>
      <div class="flex h-[calc(100vh-15rem)] min-h-[480px] flex-col">
        <div class="mb-3 flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
            :class="terminal.connected.value ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="terminal.connected.value ? 'animate-pulse bg-emerald-500' : 'bg-neutral-500'" />
            {{ terminal.connected.value ? 'CONNECTED' : 'DISCONNECTED' }}
          </span>
          <span v-if="terminal.error.value" class="text-xs text-red-400">{{ terminal.error.value }}</span>
          <button class="btn ml-auto !py-1 text-xs" @click="reconnect">
            <RefreshCw class="h-3.5 w-3.5" /> Reconnect
          </button>
        </div>

        <div :ref="terminal.containerRef" class="card min-h-0 flex-1 overflow-hidden p-0" />

        <div class="mt-2 text-xs text-neutral-500">
          <p>Type commands and press <span class="kbd">Enter</span> to run them on the device. Interactive programs such as <code class="font-mono">vi</code> or <code class="font-mono">top</code> may not render correctly.</p>
        </div>
      </div>
    </template>
  </DeviceScaffold>
</template>