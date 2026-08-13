<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const colors: Record<string, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-accent',
  warning: 'text-yellow-400',
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4">
      <TransitionGroup name="fade" tag="div" class="pointer-events-none flex w-full max-w-sm flex-col gap-2">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur"
        >
          <component :is="icons[t.type]" :class="['mt-0.5 h-4 w-4 shrink-0', colors[t.type]]" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-neutral-100">{{ t.title }}</p>
            <p v-if="t.message" class="mt-0.5 text-xs text-neutral-400 break-words">{{ t.message }}</p>
          </div>
          <button class="shrink-0 text-neutral-500 hover:text-neutral-300" @click="dismiss(t.id)">
            <X class="h-4 w-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>