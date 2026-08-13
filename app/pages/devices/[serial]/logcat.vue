<script setup lang="ts">
import { ArrowDownToLine, Copy, Download, Loader2, Pause, Play, RotateCcw, Search, Trash2 } from 'lucide-vue-next'

const route = useRoute()
const serial = computed(() => String(route.params.serial))
const logcat = useLogcat(serial)

const toast = useToast()
const scrollRef = ref<HTMLDivElement | null>(null)
const autoScroll = ref(true)
const showLatestBtn = ref(false)
const packages = ref<{ package: string; label: string }[]>([])
const MAX_RENDER = 600

const apps = useApps(serial)

onMounted(async () => {
  apps.type.value = 'user'
  await apps.load().catch(() => {})
  packages.value = apps.apps.value.map((a) => ({ package: a.package, label: a.label }))
  logcat.connect()
})

onBeforeUnmount(() => logcat.disconnect())

function onScroll() {
  if (!scrollRef.value) return
  const el = scrollRef.value
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
  autoScroll.value = atBottom
  showLatestBtn.value = !atBottom
}

function scrollToBottom() {
  if (!scrollRef.value) return
  scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  autoScroll.value = true
  showLatestBtn.value = false
}

watch(
  () => logcat.entries.value.length,
  () => {
    if (autoScroll.value) {
      nextTick(scrollToBottom)
    }
  },
)

const visibleEntries = computed(() => {
  const list = logcat.displayEntries.value
  if (list.length <= MAX_RENDER) return list
  return list.slice(list.length - MAX_RENDER)
})

const levelColors: Record<string, string> = {
  VERBOSE: 'text-neutral-400',
  DEBUG: 'text-sky-400',
  INFO: 'text-emerald-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  FATAL: 'text-red-500 font-semibold',
  SILENT: 'text-neutral-500',
}

async function copySelected() {
  const text = visibleEntries.value.map((e) => e.raw).join('\n')
  if (!text) return
  await navigator.clipboard.writeText(text)
  toast.success('Copied', `${visibleEntries.value.length} lines`)
}

async function doClearDevice() {
  const ok = await useConfirm().confirm({
    title: 'Clear device log buffer?',
    message: 'This clears the logcat buffer on the device. New log entries will still arrive.',
    confirmLabel: 'Clear',
    destructive: true,
  })
  if (ok) {
    await logcat.clearDevice()
    toast.success('Log buffer cleared')
  }
}
</script>

<template>
  <DeviceScaffold :serial="serial" title="Logcat">
    <template #default>
      <div class="flex h-[calc(100vh-15rem)] min-h-[480px] flex-col">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
            :class="logcat.connected.value ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="logcat.connected.value ? 'animate-pulse bg-emerald-500' : 'bg-neutral-500'" />
            {{ logcat.connected.value ? 'LIVE' : 'OFFLINE' }}
          </span>

          <button class="btn !py-1 text-xs" @click="logcat.live.value = !logcat.live.value">
            <Pause v-if="logcat.live.value" class="h-3.5 w-3.5" />
            <Play v-else class="h-3.5 w-3.5" />
            {{ logcat.live.value ? 'Pause' : 'Resume' }}
          </button>
          <button class="btn !py-1 text-xs" @click="logcat.clearLocal(); scrollToBottom()">
            <RotateCcw class="h-3.5 w-3.5" /> Clear view
          </button>
          <button class="btn !py-1 text-xs" @click="doClearDevice">
            <Trash2 class="h-3.5 w-3.5" /> Clear device buffer
          </button>
          <button class="btn !py-1 text-xs" @click="logcat.exportLogs()">
            <Download class="h-3.5 w-3.5" /> Export
          </button>
        </div>

        <div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div>
            <label class="label">Package</label>
            <select v-model="logcat.packageName.value" class="input">
              <option value="">All packages</option>
              <option v-for="p in packages" :key="p.package" :value="p.package">{{ p.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Level</label>
            <select v-model="logcat.level.value" class="input">
              <option v-for="l in ['ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']" :key="l" :value="l">{{ l }}</option>
            </select>
          </div>
          <div>
            <label class="label">Tag</label>
            <input v-model="logcat.tag.value" class="input" placeholder="Filter by tag…" />
          </div>
          <div>
            <label class="label">Search</label>
            <div class="relative">
              <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
              <input v-model="logcat.search.value" class="input !pl-8" placeholder="Search logs…" />
            </div>
          </div>
        </div>

        <div class="mb-3 flex flex-wrap items-center gap-4 text-sm text-neutral-400">
          <label class="inline-flex items-center gap-1.5">
            <input v-model="logcat.live.value" type="checkbox" class="accent-accent" /> Live
          </label>
          <label class="inline-flex items-center gap-1.5">
            <input v-model="logcat.regex.value" type="checkbox" class="accent-accent" /> Regex
          </label>
          <label class="inline-flex items-center gap-1.5">
            <input v-model="logcat.showTimestamps.value" type="checkbox" class="accent-accent" /> Show timestamps
          </label>
          <label class="inline-flex items-center gap-1.5">
            <input v-model="logcat.wrap.value" type="checkbox" class="accent-accent" /> Wrap lines
          </label>
          <span class="ml-auto text-xs text-neutral-500">{{ logcat.entries.value.length.toLocaleString() }} entries buffered</span>
        </div>

        <div
          ref="scrollRef"
          class="card relative flex-1 overflow-hidden overflow-y-auto"
          @scroll.passive="onScroll"
        >
          <table class="w-full border-collapse font-mono text-xs leading-5">
            <tbody>
              <tr
                v-for="(entry, i) in visibleEntries"
                :key="i"
                class="group align-top hover:bg-neutral-800/40"
              >
                <td v-if="logcat.showTimestamps.value" class="whitespace-nowrap py-0.5 pl-3 pr-3 text-neutral-500 select-none">
                  {{ entry.timestamp }}
                </td>
                <td class="whitespace-nowrap py-0.5 pr-3 select-none">
                  <span :class="levelColors[entry.level] || 'text-neutral-300'">{{ entry.level }}</span>
                </td>
                <td class="max-w-[160px] truncate py-0.5 pr-3 text-sky-400/90 select-none">
                  {{ entry.tag }}
                </td>
                <td :class="['min-w-0 py-0.5 pr-3 text-neutral-300', logcat.wrap.value ? 'whitespace-pre-wrap break-all' : 'whitespace-pre']">
                  {{ entry.message }}
                </td>
                <td class="w-6 py-0.5 pr-2 opacity-0 group-hover:opacity-100">
                  <button class="text-neutral-500 hover:text-neutral-300" title="Copy line" @click="logcat.copyLine(entry)">
                    <Copy class="h-3 w-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="visibleEntries.length === 0 && logcat.connected.value" class="flex h-full items-center justify-center text-sm text-neutral-600">
            Waiting for log output…
          </div>
          <div v-if="logcat.error.value" class="flex h-full items-center justify-center text-sm text-red-400">
            {{ logcat.error.value }}
          </div>

          <button
            v-if="showLatestBtn"
            class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 shadow-lg hover:bg-neutral-800"
            @click="scrollToBottom"
          >
            <ArrowDownToLine class="h-3.5 w-3.5" /> Jump to latest
          </button>

          <button
            class="absolute right-3 top-3 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            title="Copy visible logs"
            @click="copySelected"
          >
            <Copy class="h-3 w-3" />
          </button>
        </div>
      </div>
    </template>
  </DeviceScaffold>
</template>