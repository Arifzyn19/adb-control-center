<script setup lang="ts">
import { KeyRound, Loader2 } from 'lucide-vue-next'

const auth = useAuth()
const token = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function submit() {
  if (!token.value) return
  loading.value = true
  error.value = null
  try {
    await auth.login(token.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign in failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-sm p-6">
    <div class="mb-8 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <KeyRound class="h-5 w-5" />
      </div>
      <div>
        <h1 class="text-lg font-semibold text-neutral-100">ADB Control Center</h1>
        <p class="text-sm text-neutral-500">Android device management</p>
      </div>
    </div>

    <form @submit.prevent="submit">
      <label class="label" for="token">Access token</label>
      <input
        id="token"
        v-model="token"
        type="password"
        class="input"
        placeholder="Enter your access token"
        autocomplete="current-password"
        autofocus
      />
      <p v-if="error" class="mt-2 text-sm text-red-400">{{ error }}</p>
      <button type="submit" class="btn-primary mt-4 w-full" :disabled="loading || !token">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        Sign in
      </button>
    </form>

    <p class="mt-6 text-center text-xs text-neutral-600">
      Configure <code class="text-neutral-500">ADB_CONTROL_TOKEN</code> on the server to change the default token.
    </p>
  </div>
</template>