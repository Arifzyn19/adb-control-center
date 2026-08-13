<script setup lang="ts">
import { AppWindow, Download, Loader2, MoreVertical, Play, Power, RotateCcw, Square, Trash2, Upload, X } from 'lucide-vue-next'
import type { AppInfo } from '../../../../shared/types'
import { formatBytes } from '~/utils/format'

const route = useRoute()
const serial = computed(() => String(route.params.serial))

const apps = useApps(serial)
const toast = useToast()
const confirm = useConfirm()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const installing = ref<string | null>(null)

onMounted(() => apps.load())

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    uploading.value = true
    apps.install(file).finally(() => {
      uploading.value = false
      input.value = ''
    })
  }
}

async function confirmUninstall(app: AppInfo) {
  const ok = await confirm.confirm({
    title: `Uninstall ${app.label}?`,
    message: `${app.package} will be removed from the device.`,
    confirmLabel: 'Uninstall',
    destructive: true,
  })
  if (ok) await apps.uninstall(app)
}

async function confirmClearData(app: AppInfo) {
  const ok = await confirm.confirm({
    title: `Clear data for ${app.label}?`,
    message: `All application data and files will be deleted. This cannot be undone.`,
    confirmLabel: 'Clear data',
    destructive: true,
  })
  if (ok) await apps.clear('data', app)
}

async function confirmDisable(app: AppInfo) {
  const ok = await confirm.confirm({
    title: `Disable ${app.label}?`,
    message: 'The application will be disabled and removed from the launcher.',
    confirmLabel: 'Disable',
    destructive: true,
  })
  if (ok) await apps.setEnabled(app, false)
}

async function doReinstall(app: AppInfo) {
  const ok = await confirm.confirm({
    title: `Reinstall ${app.label}?`,
    message: 'The current APK will be reinstalled.',
    confirmLabel: 'Reinstall',
  })
  if (ok) await apps.reinstall(app)
}
</script>

<template>
  <DeviceScaffold :serial="serial" title="Apps">
    <template #default>
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <input v-model="apps.search.value" class="input w-64" placeholder="Search applications…" @input="apps.load()" />
        <div class="flex rounded-lg border border-neutral-800 p-0.5">
          <button
            v-for="t in ['all', 'user', 'system'] as const"
            :key="t"
            class="rounded-md px-3 py-1 text-xs font-medium capitalize"
            :class="apps.type.value === t ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'"
            @click="apps.type.value = t; apps.load()"
          >
            {{ t }}
          </button>
        </div>
        <button class="btn ml-auto" @click="apps.load()">Refresh</button>
        <button class="btn-primary" :disabled="uploading" @click="fileInput?.click()">
          <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" />
          <Upload v-else class="h-4 w-4" />
          Install APK
        </button>
        <input ref="fileInput" type="file" accept=".apk" class="hidden" @change="onFileSelected" />
      </div>

      <EmptyState
        v-if="apps.loading.value"
        title="Loading applications…"
        description="Reading the package list from the device."
      />
      <EmptyState v-else-if="apps.error.value" :title="apps.error.value" />
      <EmptyState v-else-if="apps.filteredApps.value.length === 0" title="No applications found" />

      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="app in apps.filteredApps.value" :key="app.package" class="card flex flex-col p-4">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-800/70 text-neutral-300">
              <AppWindow class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-neutral-100">
                {{ app.label }}
                <span v-if="!app.isEnabled" class="ml-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] text-yellow-400">disabled</span>
              </p>
              <p class="truncate font-mono text-xs text-neutral-500">{{ app.package }}</p>
              <p class="mt-0.5 text-xs text-neutral-500">
                v{{ app.versionName || '—' }} · {{ app.isSystem ? 'system' : 'user' }}
              </p>
            </div>
            <button class="btn-ghost h-7 w-7 shrink-0 !p-0" @click="apps.openDetails(app)">
              <MoreVertical class="h-3.5 w-3.5" />
            </button>
          </div>

          <div class="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-800 pt-3">
            <button class="btn !px-2.5 !py-1 text-xs" @click="apps.launch(app)"><Play class="h-3 w-3" /> Launch</button>
            <button class="btn !px-2.5 !py-1 text-xs" @click="apps.forceStop(app)"><Square class="h-3 w-3" /> Stop</button>
            <div class="relative ml-auto">
              <button class="btn-ghost h-7 w-7 !p-0" @click="apps.selected.value = app">
                <MoreVertical class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <div
          v-if="apps.selected.value"
          class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          @click.self="apps.selected.value = null"
        >
          <div class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/50">
            <div class="flex items-start justify-between border-b border-neutral-800 px-5 py-4">
              <div>
                <h3 class="text-sm font-semibold text-neutral-100">{{ apps.selected.value.label }}</h3>
                <p class="font-mono text-xs text-neutral-500">{{ apps.selected.value.package }}</p>
              </div>
              <button class="text-neutral-500 hover:text-neutral-300" @click="apps.selected.value = null">
                <X class="h-4 w-4" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-5 py-4">
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">Version</dt>
                  <dd class="text-neutral-200">{{ apps.selected.value.versionName || '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">Version code</dt>
                  <dd class="text-neutral-200">{{ apps.selected.value.versionCode ?? '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">UID</dt>
                  <dd class="text-neutral-200">{{ apps.selected.value.uid ?? '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">APK path</dt>
                  <dd class="break-all font-mono text-neutral-200">{{ apps.selected.value.apkPath || '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">Size</dt>
                  <dd class="text-neutral-200">{{ formatBytes(apps.selected.value.sizeBytes) }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">Target SDK</dt>
                  <dd class="text-neutral-200">{{ apps.selected.value.targetSdk ?? '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">First installed</dt>
                  <dd class="text-neutral-200">{{ apps.selected.value.firstInstallTime || '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-neutral-500">Permissions</dt>
                  <dd class="text-neutral-200">{{ apps.selected.value.permissions.length }}</dd>
                </div>
              </dl>

              <details v-if="apps.selected.value.permissions.length" class="mt-4">
                <summary class="cursor-pointer text-xs font-medium text-neutral-400">Show {{ apps.selected.value.permissions.length }} permissions</summary>
                <div class="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-neutral-950/60 p-3">
                  <p v-for="perm in apps.selected.value.permissions" :key="perm" class="font-mono text-xs text-neutral-400">
                    {{ perm }}
                  </p>
                </div>
              </details>
            </div>

            <div class="flex flex-wrap gap-1.5 border-t border-neutral-800 px-5 py-3">
              <button class="btn !px-2.5 !py-1 text-xs" @click="apps.launch(apps.selected.value)"><Play class="h-3 w-3" /> Launch</button>
              <button class="btn !px-2.5 !py-1 text-xs" @click="apps.forceStop(apps.selected.value)"><Square class="h-3 w-3" /> Force stop</button>
              <button class="btn !px-2.5 !py-1 text-xs" @click="apps.clear('cache', apps.selected.value)">Clear cache</button>
              <button class="btn !px-2.5 !py-1 text-xs" @click="confirmClearData(apps.selected.value)">Clear data</button>
              <button
                class="btn !px-2.5 !py-1 text-xs"
                @click="apps.setEnabled(apps.selected.value, !apps.selected.value.isEnabled)"
              >
                <Power class="h-3 w-3" /> {{ apps.selected.value.isEnabled ? 'Disable' : 'Enable' }}
              </button>
              <button class="btn !px-2.5 !py-1 text-xs" @click="apps.extract(apps.selected.value)">
                <Download class="h-3 w-3" /> Extract APK
              </button>
              <button class="btn !px-2.5 !py-1 text-xs" @click="doReinstall(apps.selected.value)">
                <RotateCcw class="h-3 w-3" /> Reinstall
              </button>
              <button class="btn-danger !px-2.5 !py-1 text-xs" @click="confirmUninstall(apps.selected.value)">
                <Trash2 class="h-3 w-3" /> Uninstall
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </DeviceScaffold>
</template>