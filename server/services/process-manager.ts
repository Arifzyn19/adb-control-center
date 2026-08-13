import type { ProcessInfo } from '../../shared/types'
import * as adb from './adb'
import * as deviceManager from './device-manager'
import { parseSizeToBytes } from './device-manager'

export interface ProcessDetails extends ProcessInfo {
  args: string[]
}

export async function listProcesses(serial: string): Promise<ProcessInfo[]> {
  deviceManager.requireDevice(serial)
  const res = await adb.shell(serial, 'top -b -n 1 -m 512', { timeoutMs: 20_000, maxBuffer: 16 * 1024 * 1024 })
  return parseTopOutput(res.stdout)
}

export function parseTopOutput(output: string): ProcessInfo[] {
  const processes: ProcessInfo[] = []
  let headerIdx = -1
  const lines = output.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*PID\s+USER/.test(lines[i] ?? '')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return processes

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+\d+\s+-?\d+\s+(\S+)\s+(\S+)\s+\S+\s+\S\s+([\d.]+)\s+([\d.]+)\s+\S+\s+(.+)$/)
    if (!m) continue
    processes.push({
      pid: Number(m[1]!),
      user: m[2]!,
      name: m[7]!,
      ppid: null,
      cpuPct: Number(m[5]!),
      memBytes: parseSizeToBytes(m[4]!),
      memPct: Number(m[6]!),
    })
  }
  return processes
}

export async function getProcessDetails(serial: string, pid: number): Promise<ProcessDetails | null> {
  const res = await adb.shell(serial, `ps -A -o PID,PPID,USER,NAME -p ${pid}`, { timeoutMs: 10_000 })
  const lines = res.stdout.split(/\r?\n/)
  const header = lines.findIndex((l) => /^\s*PID/.test(l))
  const body = lines.slice(header + 1).find((l) => l.trim())
  if (!body) return null
  const parts = body.trim().split(/\s+/)
  const name = parts.slice(3).join(' ')
  const proc = await listProcesses(serial)
  const found = proc.find((p) => p.pid === pid)
  return {
    pid,
    ppid: Number(parts[1]) || null,
    user: parts[2] ?? '',
    name,
    cpuPct: found?.cpuPct ?? 0,
    memBytes: found?.memBytes ?? 0,
    memPct: found?.memPct ?? 0,
    args: name.split(' '),
  }
}

export async function killProcess(serial: string, pid: number) {
  deviceManager.requireDevice(serial)
  const res = await adb.shell(serial, `kill -9 ${pid}`, { timeoutMs: 10_000 })
  if (res.code !== 0 && !/No such process/i.test(res.stderr)) {
    throw Errors.commandFailed(res.stderr.trim() || `Failed to kill process ${pid}`, res.stderr)
  }
}