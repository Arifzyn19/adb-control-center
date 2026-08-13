<script setup lang="ts">
import {
  ArrowDownToLine,
  ArrowUp,
  ChevronLeft,
  File,
  FileArchive,
  Folder,
  FolderPlus,
  MoreVertical,
  PackagePlus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-vue-next'
import { formatBytes, formatDate } from '~/utils/format'
import type { FileEntry } from '../../../../shared/types'

const route = useRoute()
const serial = computed(() => String(route.params.serial))
const files = useFiles(serial)
const confirm = useConfirm()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const renameTarget = ref<FileEntry | null>(null)
const renameValue = ref('')
const mkdirOpen = ref(false)
const mkdirValue = ref('')
const menuFor = ref<string | null>(null)

onMounted(() => files.load())

const rootPaths = ['/sdcard', '/sdcard/Download', '/sdcard/DCIM', '/data/data', '/storage/emulated/0']

function iconFor(entry: FileEntry) {
  if (entry.type === 'dir') return Folder
  if (entry.name.endsWith('.apk')) return FileArchive
  return File
}

function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) files.upload(input.files, files.path.value)
  input.value = ''
}

async function doDelete(entry: FileEntry) {
  menuFor.value = null
  const ok = await confirm.confirm({
    title: `Delete ${entry.name}?`,
    message: entry.type === 'dir' ? 'The folder and all its contents will be permanently deleted.' : 'This file will be permanently deleted.',
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (ok) await files.remove(entry)
}

async function doMkdir() {
  const name = mkdirValue.value.trim()
  if (!name) return
  mkdirOpen.value = false
  mkdirValue.value = ''
  await files.mkdir(name)
}

async function doRename() {
  const name = renameValue.value.trim()
  if (!name || !renameTarget.value) return
  const target = renameTarget.value
  renameTarget.value = null
  await files.rename(target, name)
}

function canInstallApk(entry: FileEntry) {
  return entry.type === 'file' && entry.name.toLowerCase().endsWith('.apk')
}
</script>

<template>
  <DeviceScaffold :serial="serial" title="Files">
    <template #default>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button class="btn !py-1 text-xs" @click="files.up()" :disabled="!files.parent.value">
          <ChevronLeft class="h-3.5 w-3.5" /> Up
        </button>
        <select
          :value="files.path.value"
          class="input !w-auto !py-1 text-xs"
          @change="files.navigate(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in rootPaths" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="btn !py-1 text-xs" @click="files.load()"><RefreshCw class="h-3.5 w-3.5" /> Refresh</button>
        <button class="btn !py-1 text-xs" @click="mkdirOpen = true"><FolderPlus class="h-3.5 w-3.5" /> New folder</button>
        <button class="btn-primary ml-auto !py-1 text-xs" @click="fileInput?.click()">
          <Upload class="h-3.5 w-3.5" /> Upload
        </button>
        <input ref="fileInput" type="file" multiple class="hidden" @change="onUpload" />
      </div>

      <div class="mb-3 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
        <ArrowUp class="h-3.5 w-3.5 text-neutral-500" />
        <span class="font-mono text-sm text-neutral-300">{{ files.path.value }}</span>
        <button class="ml-auto text-neutral-500 hover:text-neutral-300" @click="files.navigate('/')">Go to root</button>
      </div>

      <EmptyState v-if="files.loading.value" title="Loading directory…" />
      <EmptyState v-else-if="files.error.value" :title="files.error.value" />
      <EmptyState v-else-if="files.entries.value.length === 0" title="Empty directory" />

      <div v-else class="card divide-y divide-neutral-800">
        <div
          v-for="entry in files.entries.value"
          :key="entry.path"
          class="group flex items-center gap-3 px-3 py-2 hover:bg-neutral-900/40"
          @dblclick="files.openEntry(entry)"
        >
          <component :is="iconFor(entry)" class="h-4 w-4 shrink-0 text-neutral-500" />

          <button class="min-w-0 flex-1 text-left" @click="files.openEntry(entry)">
            <p class="truncate text-sm text-neutral-200">{{ entry.name }}</p>
            <p class="truncate text-xs text-neutral-500">
              {{ entry.type === 'dir' ? 'Folder' : formatBytes(entry.size) }} · {{ entry.permissions }} · {{ entry.owner }}:{{ entry.group }} · {{ formatDate(entry.modified) }}
            </p>
          </button>

          <span v-if="canInstallApk(entry)" class="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">APK</span>

          <div class="relative shrink-0">
            <button class="btn-ghost h-7 w-7 !p-0 opacity-0 group-hover:opacity-100" @click="menuFor = menuFor === entry.path ? null : entry.path">
              <MoreVertical class="h-3.5 w-3.5" />
            </button>
            <div
              v-if="menuFor === entry.path"
              class="absolute right-0 top-8 z-40 w-44 rounded-xl border border-neutral-800 bg-neutral-900 p-1.5 shadow-xl shadow-black/50"
              @click.self="menuFor = null"
            >
              <button
                v-if="entry.type === 'dir'"
                class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
                @click="files.openEntry(entry); menuFor = null"
              >
                Open
              </button>
              <button
                v-if="entry.type === 'file'"
                class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
                @click="files.download(entry); menuFor = null"
              >
                <span class="inline-flex items-center gap-2"><ArrowDownToLine class="h-3.5 w-3.5" /> Download</span>
              </button>
              <button
                v-if="canInstallApk(entry)"
                class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
                @click="files.installApk(entry); menuFor = null"
              >
                <span class="inline-flex items-center gap-2"><PackagePlus class="h-3.5 w-3.5" /> Install APK</span>
              </button>
              <button
                class="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
                @click="renameTarget = entry; renameValue = entry.name; menuFor = null"
              >
                Rename
              </button>
              <button
                class="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                @click="doDelete(entry)"
              >
                <span class="inline-flex items-center gap-2"><Trash2 class="h-3.5 w-3.5" /> Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <div
          v-if="renameTarget"
          class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          @click.self="renameTarget = null"
        >
          <div class="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl shadow-black/50">
            <h3 class="text-sm font-semibold text-neutral-100">Rename</h3>
            <input v-model="renameValue" class="input mt-3" autofocus @keyup.enter="doRename" />
            <div class="mt-4 flex justify-end gap-2">
              <button class="btn" @click="renameTarget = null">Cancel</button>
              <button class="btn-primary" @click="doRename">Rename</button>
            </div>
          </div>
        </div>

        <div
          v-if="mkdirOpen"
          class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          @click.self="mkdirOpen = false"
        >
          <div class="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl shadow-black/50">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-neutral-100">New folder</h3>
              <button class="text-neutral-500 hover:text-neutral-300" @click="mkdirOpen = false"><X class="h-4 w-4" /></button>
            </div>
            <input v-model="mkdirValue" class="input mt-3" placeholder="Folder name" autofocus @keyup.enter="doMkdir" />
            <div class="mt-4 flex justify-end gap-2">
              <button class="btn" @click="mkdirOpen = false">Cancel</button>
              <button class="btn-primary" @click="doMkdir">Create</button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </DeviceScaffold>
</template>