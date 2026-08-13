<script setup lang="ts">
import { Circle } from 'lucide-vue-next'

defineProps<{
  status: 'connected' | 'offline' | 'unauthorized' | 'disconnected' | 'connecting' | string
  pulse?: boolean
}>()

const colors: Record<string, string> = {
  connected: 'text-emerald-500',
  offline: 'text-red-500',
  unauthorized: 'text-yellow-500',
  disconnected: 'text-neutral-600',
  connecting: 'text-yellow-500',
}

const labels: Record<string, string> = {
  connected: 'Connected',
  offline: 'Offline',
  unauthorized: 'Unauthorized',
  disconnected: 'Disconnected',
  connecting: 'Connecting',
}
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <Circle
      :class="[
        'h-2 w-2 fill-current',
        colors[status] || 'text-neutral-600',
        pulse && status === 'connected' ? 'animate-pulse' : '',
      ]"
    />
    <span class="text-xs text-neutral-400">{{ labels[status] || status }}</span>
  </span>
</template>