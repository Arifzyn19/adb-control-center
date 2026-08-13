import { serialSchema } from '../../../utils/validation'
import * as adb from '../../../services/adb'

interface Section {
  id: string
  title: string
  summary: { label: string; value: string }[]
  raw: string
}

async function run(serial: string, cmd: string): Promise<string> {
  try {
    const res = await adb.shell(serial, cmd, { timeoutMs: 12_000, maxBuffer: 8 * 1024 * 1024 })
    return res.stdout
  } catch {
    return ''
  }
}

function parseKeyValue(out: string, keys: string[]): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = []
  for (const key of keys) {
    const m = out.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'))
    if (m) result.push({ label: key, value: m[1]!.trim() })
  }
  return result
}

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)

  const [cpu, mem, battery, power, window, disk, activity] = await Promise.all([
    run(serial, 'dumpsys cpuinfo'),
    run(serial, 'dumpsys meminfo'),
    run(serial, 'dumpsys battery'),
    run(serial, 'dumpsys power'),
    run(serial, 'dumpsys window'),
    run(serial, 'dumpsys diskstats'),
    run(serial, "dumpsys activity activities | grep -E 'mResumedActivity|mFocusedActivity'"),
  ])

  const sections: Section[] = []

  const cpuLines = cpu.split(/\r?\n/).filter((l) => /^\s*\d/.test(l)).slice(0, 8)
  sections.push({
    id: 'cpu',
    title: 'CPU Usage',
    summary: parseKeyValue(cpu, ['TOTAL']).concat(
      cpuLines.slice(0, 5).map((l) => {
        const [pct, ...rest] = l.trim().split(/\s+/)
        return { label: rest.join(' ') || 'Process', value: pct ?? '' }
      }),
    ),
    raw: cpu,
  })

  const memSummary = mem.match(/^Total RAM:\s+(.+)$/m)?.[1] ?? ''
  const used = mem.match(/^Used RAM:\s+(.+)$/m)?.[1] ?? ''
  sections.push({
    id: 'memory',
    title: 'Memory',
    summary: [
      { label: 'Total RAM', value: memSummary },
      { label: 'Used RAM', value: used },
    ].filter((s) => s.value),
    raw: mem,
  })

  sections.push({
    id: 'battery',
    title: 'Battery',
    summary: parseKeyValue(battery, ['level', 'scale', 'status', 'health', 'temperature', 'technology', 'voltage']),
    raw: battery,
  })

  const interactive = power.match(/^mWakefulness=(\w+)$/m)?.[1] ?? ''
  sections.push({
    id: 'power',
    title: 'Power State',
    summary: [
      { label: 'Wakefulness', value: interactive },
      ...parseKeyValue(power, ['mScreenOn']),
    ],
    raw: power,
  })

  const focus = window.match(/^mCurrentFocus=(\S+)/m)?.[1] ?? window.match(/^\s+mCurrentFocus=(\S+)/m)?.[1] ?? ''
  sections.push({
    id: 'window',
    title: 'Window Focus',
    summary: [
      { label: 'Current Focus', value: focus },
      ...parseKeyValue(window, ['mFocusedApp']),
    ],
    raw: window,
  })

  sections.push({
    id: 'disk',
    title: 'Disk Stats',
    summary: [],
    raw: disk,
  })

  const topActivity = activity
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  sections.push({
    id: 'activity',
    title: 'Top Activity',
    summary: topActivity.map((l) => {
      const parts = l.split(/\s+/)
      const key = parts[0]?.replace(':', '') ?? 'Activity'
      const value = parts.slice(1).join(' ') || l
      return { label: key, value }
    }),
    raw: activity,
  })

  return sections
})