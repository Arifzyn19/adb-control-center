import type { LogEntry, LogLevel } from '../../shared/types'
import * as adb from './adb'
import { bus } from '../utils/bus'

interface LogcatFilters {
  level: LogLevel
  tag?: string
  pid?: number
  packageName?: string
}

interface LogcatSession {
  serial: string
  child: ReturnType<typeof adb.spawnLogcat> | null
  buffer: LogEntry[]
  listeners: number
  filters: LogcatFilters
  pidResolveTimer: ReturnType<typeof setInterval> | null
  resolvedPid: number | null
  lastActivity: number
}

const sessions = new Map<string, LogcatSession>()
const MAX_BUFFER = 2000

const LEVEL_ORDER: Record<string, number> = { V: 1, D: 2, I: 3, W: 4, E: 5, F: 6, S: 7 }
const LEVEL_BY_CHAR: Record<string, string> = {
  V: 'VERBOSE',
  D: 'DEBUG',
  I: 'INFO',
  W: 'WARN',
  E: 'ERROR',
  F: 'FATAL',
  S: 'SILENT',
}

function parseThreadtimeLine(line: string): LogEntry | null {
  const m = line.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+([^:]+?)\s*:\s*(.*)$/)
  if (!m) return null
  return {
    timestamp: m[1]!,
    level: LEVEL_BY_CHAR[m[4]!] || m[4]!,
    tag: m[5]!.trim(),
    pid: Number(m[2]!),
    tid: Number(m[3]!),
    message: m[6]!,
    raw: line,
  }
}

function passesFilters(entry: LogEntry, filters: LogcatFilters): boolean {
  if (filters.level && filters.level !== 'ALL') {
    const threshold = LEVEL_ORDER[filters.level[0]!] ?? 1
    if ((LEVEL_ORDER[entry.level[0]!] ?? 0) < threshold) return false
  }
  if (filters.pid !== undefined && entry.pid !== filters.pid) return false
  if (filters.tag && !entry.tag.toLowerCase().includes(filters.tag.toLowerCase())) return false
  return true
}

function buildArgs(filters: LogcatFilters): string[] {
  const args: string[] = ['-v', 'threadtime']
  if (filters.pid !== undefined) {
    args.push(`--pid=${filters.pid}`)
  }
  if (filters.level && filters.level !== 'ALL') {
    args.push(`*:${filters.level[0]!.toLowerCase()}`)
  }
  return args
}

function resolvePackagePid(serial: string, pkg: string): Promise<number | null> {
  return adb
    .shell(serial, `pidof ${pkg}`, { timeoutMs: 5000 })
    .then((res) => {
      const pid = Number(res.stdout.trim().split(/\s+/)[0])
      return Number.isInteger(pid) && pid > 0 ? pid : null
    })
    .catch(() => null)
}

function getSession(serial: string): LogcatSession | null {
  return sessions.get(serial) ?? null
}

async function ensureSession(serial: string): Promise<LogcatSession> {
  let session = sessions.get(serial)
  if (session && session.child) {
    session.lastActivity = Date.now()
    return session
  }
  if (!session) {
    session = {
      serial,
      child: null,
      buffer: [],
      listeners: 0,
      filters: { level: 'ALL' },
      pidResolveTimer: null,
      resolvedPid: null,
      lastActivity: Date.now(),
    }
    sessions.set(serial, session)
  }
  session.filters = { level: 'ALL' }
  session.resolvedPid = null
  startProcess(session)
  return session
}

function startProcess(session: LogcatSession) {
  if (session.child) {
    session.child.kill()
    session.child = null
  }
  const args = buildArgs(session.filters)
  const child = adb.spawnLogcat(session.serial, args)
  session.child = child

  let carry = ''
  child.stdout.on('data', (chunk: Buffer) => {
    carry += chunk.toString('utf8')
    const lines = carry.split(/\r?\n/)
    carry = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      const entry = parseThreadtimeLine(line)
      if (!entry) continue
      if (!passesFilters(entry, session.filters)) continue
      session.buffer.push(entry)
      if (session.buffer.length > MAX_BUFFER) session.buffer.splice(0, session.buffer.length - MAX_BUFFER)
      bus.emit('logcat:entry', session.serial, entry)
    }
  })

  child.on('error', () => {
    session.child = null
  })
  child.on('close', () => {
    session.child = null
  })
}

function applyFilters(session: LogcatSession, filters: LogcatFilters) {
  const changed =
    session.filters.level !== filters.level ||
    session.filters.tag !== filters.tag ||
    session.filters.packageName !== filters.packageName
  session.filters = { ...filters }
  if (filters.packageName) {
    session.resolvedPid = null
    if (session.pidResolveTimer) clearInterval(session.pidResolveTimer)
    const tick = async () => {
      const pid = await resolvePackagePid(session.serial, filters.packageName!)
      if (pid !== session.resolvedPid) {
        session.resolvedPid = pid
        session.filters.pid = pid ?? undefined
        startProcess(session)
      }
    }
    tick()
    session.pidResolveTimer = setInterval(tick, 5000)
    session.pidResolveTimer.unref()
  } else {
    session.filters.pid = undefined
    if (session.pidResolveTimer) {
      clearInterval(session.pidResolveTimer)
      session.pidResolveTimer = null
    }
  }
  if (changed) startProcess(session)
}

export async function attachLogcat(
  serial: string,
  filters: LogcatFilters,
  onEntry: (entry: LogEntry) => void,
): Promise<() => void> {
  const session = await ensureSession(serial)
  session.listeners++
  session.lastActivity = Date.now()
  applyFilters(session, filters)

  const handler = (s: string, entry: LogEntry) => {
    if (s === serial) onEntry(entry)
  }
  bus.on('logcat:entry', handler)

  return () => {
    bus.off('logcat:entry', handler)
    session.listeners--
    session.lastActivity = Date.now()
    if (session.listeners <= 0) {
      setTimeout(() => {
        if (session.listeners <= 0) stopSession(session.serial)
      }, 5000).unref()
    }
  }
}

export function getBuffer(serial: string): LogEntry[] {
  return getSession(serial)?.buffer ?? []
}

export function setFilters(serial: string, filters: LogcatFilters) {
  const session = getSession(serial)
  if (session) applyFilters(session, filters)
}

export function stopSession(serial: string) {
  const session = sessions.get(serial)
  if (!session) return
  if (session.pidResolveTimer) clearInterval(session.pidResolveTimer)
  if (session.child) {
    session.child.kill()
  }
  session.buffer = []
  sessions.delete(serial)
}

export async function clearDeviceLogcat(serial: string) {
  await adb.shell(serial, 'logcat -c', { timeoutMs: 10_000 })
  const session = getSession(serial)
  if (session) session.buffer = []
}

export async function dumpLogcat(serial: string, filters: LogcatFilters = { level: 'ALL' }): Promise<string> {
  const args = ['-d', '-v', 'threadtime']
  if (filters.pid !== undefined) args.push(`--pid=${filters.pid}`)
  if (filters.level && filters.level !== 'ALL') args.push(`*:${filters.level[0]!.toLowerCase()}`)
  const child = adb.spawnLogcat(serial, args)
  const chunks: Buffer[] = []
  child.stdout.on('data', (d) => chunks.push(d))
  await new Promise<void>((resolve) => {
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })
  return Buffer.concat(chunks).toString('utf8')
}

export function getSessionInfo() {
  return [...sessions.entries()].map(([serial, s]) => ({
    serial,
    listeners: s.listeners,
    buffer: s.buffer.length,
    filters: s.filters,
  }))
}

export function stopAllSessions() {
  for (const serial of [...sessions.keys()]) stopSession(serial)
}