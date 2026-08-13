<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-16 text-center">
    <div class="text-neutral-600">
      <slot name="icon" />
    </div>
    <p v-if="title" class="text-sm font-medium text-neutral-300">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-sm text-neutral-500">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>