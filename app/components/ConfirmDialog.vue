<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'

const { state, resolve } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      @click.self="resolve(false)"
    >
      <div class="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl shadow-black/50">
        <div class="flex items-start gap-3">
          <div
            :class="[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              state.destructive ? 'bg-red-500/10 text-red-400' : 'bg-accent/10 text-accent',
            ]"
          >
            <AlertTriangle class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-neutral-100">{{ state.title }}</h3>
            <p v-if="state.message" class="mt-1 text-sm text-neutral-400">{{ state.message }}</p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button class="btn-ghost" @click="resolve(false)">Cancel</button>
          <button :class="state.destructive ? 'btn-danger' : 'btn-primary'" @click="resolve(true)">
            {{ state.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>