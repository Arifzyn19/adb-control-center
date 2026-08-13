<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

defineProps<{
  size?: 'sm' | 'md' | 'lg'
  label?: string
}>()
</script>

<template>
  <span class="inline-flex items-center gap-2 text-neutral-400">
    <Loader2 :class="['animate-spin', size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4']" />
    <span v-if="label" class="text-sm">{{ label }}</span>
  </span>
</template>