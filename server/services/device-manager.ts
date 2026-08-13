import type { DeviceInfo, DeviceStatus } from '../../shared/types'
import * as adb from './adb'
import { bus } from '../utils/bus'

const MAX_STORED_DEVICES = 64

const devices = new Map<string, DeviceInfo>()

function nowIso() {
  return new Date().toISOString()
}

export function parseSizeToBytes(input: string): number {
  const m = input.match(/([\d.]+)\s*([KMGTPE])?i?B?/i)
  if (!m) return 0
  const value = Number(m[1])
  const unit = (m[2] || '').toUpperCase()
  const mult: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5, E: 1024 ** 6 }
  return Math.round(value * (mult[unit] || 1))
}

function firstProp(props: Record<string, string>, keys: string[]) {
  for (const k of keys) {
    const v = props[k]
    if (v && v !== 'unknown') return v
  }
  return undefined
}

async function collectBattery(serial: string): Promise<{
  percent: number | null
  tempC: number | null
  status: string
  health: string
  technology: string
}> {
  try {
    const res = await adb.shell(serial, 'dumpsys battery', { timeoutMs: 10_000 })
    const out = res.stdout
    const get = (k: string) => out.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, 'm'))?.[1]?.trim()
    const level = get('level')
    const scale = get('scale')
    const temp = get('temperature')
    return {
      percent: level && scale ? Math.min(100, Math.max(0, Math.round((Number(level) / Number(scale)) * 100))) : level ? Number(level) : null,
      tempC: temp ? Number(temp) / 10 : null,
      status: get('status') || 'unknown',
      health: get('health') || 'unknown',
      technology: get('technology') || 'unknown',
    }
  } catch {
    return { percent: null, tempC: null, status: 'unknown', health: 'unknown', technology: 'unknown' }
  }
}

export async function collectMemory(serial: string): Promise<{ total: number; used: number }> {
  try {
    const res = await adb.shell(serial, 'cat /proc/meminfo', { timeoutMs: 10_000 })
    const memTotal = res.stdout.match(/^MemTotal:\s+(\d+)\s*kB/m)?.[1]
    const memFree = res.stdout.match(/^MemFree:\s+(\d+)\s*kB/m)?.[1]
    const memAvailable = res.stdout.match(/^MemAvailable:\s+(\d+)\s*kB/m)?.[1]
    if (!memTotal) return { total: 0, used: 0 }
    const total = Number(memTotal) * 1024
    const avail = memAvailable ? Number(memAvailable) * 1024 : Number(memFree || 0) * 1024
    return { total, used: Math.max(0, total - avail) }
  } catch {
    return { total: 0, used: 0 }
  }
}

export async function collectStorage(serial: string): Promise<{ total: number; used: number }> {
  try {
    const res = await adb.shell(serial, 'df -k /data', { timeoutMs: 10_000 })
    const lines = res.stdout.trim().split(/\r?\n/)
    if (lines.length < 2) return { total: 0, used: 0 }
    const cols = lines[1]!.trim().split(/\s+/)
    const total = Number(cols[1] || 0) * 1024
    const used = Number(cols[2] || 0) * 1024
    return { total, used }
  } catch {
    return { total: 0, used: 0 }
  }
}

async function collectIp(serial: string): Promise<string | null> {
  try {
    const res = await adb.shell(serial, 'ip -4 addr show', { timeoutMs: 10_000 })
    const m = res.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/)
    if (m && !m[1]!.startsWith('127.')) return m[1]! as string | null
    return null
  } catch {
    return null
  }
}

function guessConnectionType(serial: string): 'wireless' | 'usb' | 'emulator' | 'unknown' {
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(serial)) return 'wireless'
  if (serial.startsWith('emulator-')) return 'emulator'
  return 'usb'
}

async function gatherInfo(serial: string, state: string): Promise<DeviceInfo> {
  const existing = devices.get(serial)
  const props: Record<string, string> = {}
  try {
    const res = await adb.shell(serial, 'getprop', { timeoutMs: 12_000 })
    for (const line of res.stdout.split(/\r?\n/)) {
      const m = line.match(/^\[([^\]]*)\]\s*:\s*\[(.*)\]$/)
      if (m) props[m[1]!] = m[2]!
    }
  } catch {
    /* offline */
  }

  const name =
    firstProp(props, ['ro.product.marketname', 'ro.product.vendor.marketname', 'ro.product.model']) ||
    existing?.name ||
    serial.split(':')[0] ||
    serial
  const model = firstProp(props, ['ro.product.model', 'ro.product.vendor.model']) || name
  const manufacturer = firstProp(props, ['ro.product.manufacturer', 'ro.product.vendor.manufacturer', 'ro.product.brand']) || 'Unknown'
  const androidVersion = firstProp(props, ['ro.build.version.release']) || 'Unknown'
  const sdkVersion = Number(props['ro.build.version.sdk'] || '') || null
  const cpu = firstProp(props, ['ro.product.cpu.abi']) || 'unknown'

  const battery = await collectBattery(serial)
  const mem = await collectMemory(serial)
  const storage = await collectStorage(serial)
  const ip = await collectIp(serial)

  const connected = state === 'device'
  const status: DeviceStatus = state === 'device' ? 'connected' : state === 'offline' ? 'offline' : state === 'unauthorized' ? 'unauthorized' : 'offline'

  return {
    serial,
    name,
    manufacturer,
    model,
    androidVersion,
    sdkVersion,
    buildFingerprint: props['ro.build.fingerprint'] || '',
    abi: [cpu].filter(Boolean),
    cpu,
    ramTotalBytes: mem.total,
    storageTotalBytes: storage.total,
    storageUsedBytes: storage.used,
    batteryPercent: battery.percent,
    batteryTempC: battery.tempC,
    batteryStatus: battery.status,
    ipAddress: ip,
    connectionType: /:\d+$/.test(serial) ? 'wireless' : guessConnectionType(serial),
    status,
    authorized: connected,
    lastSeen: nowIso(),
    lastConnected: connected ? nowIso() : existing?.lastConnected || nowIso(),
    firstSeen: existing?.firstSeen || nowIso(),
    product: props['ro.product.name'],
  }
}

export async function refreshDevice(serial: string, state?: string): Promise<DeviceInfo> {
  const currentState = state ?? (await adb.getDeviceState(serial))
  if (currentState === null) {
    const existing = devices.get(serial)
    if (existing) {
      const updated = { ...existing, status: 'disconnected' as DeviceStatus, authorized: false, lastSeen: nowIso() }
      devices.set(serial, updated)
      bus.emit('device:update', serial, updated)
      return updated
    }
    throw Errors.deviceNotFound(serial)
  }
  const info = await gatherInfo(serial, currentState)
  devices.set(serial, info)
  bus.emit('device:update', serial, info)
  return info
}

export async function refreshAll(): Promise<DeviceInfo[]> {
  const list = await adb.listDevices()
  const online = new Set<string>()
  const results: DeviceInfo[] = []

  for (const device of list) {
    online.add(device.serial)
    try {
      results.push(await refreshDevice(device.serial, device.state))
    } catch {
      /* skip */
    }
  }

  for (const [serial, info] of devices) {
    if (!online.has(serial)) {
      const updated = { ...info, status: 'disconnected' as DeviceStatus, authorized: false, lastSeen: nowIso() }
      devices.set(serial, updated)
      bus.emit('device:update', serial, updated)
    }
  }

  return [...devices.values()]
}

export function getDevice(serial: string): DeviceInfo | undefined {
  return devices.get(serial)
}

export function requireDevice(serial: string): DeviceInfo {
  const device = devices.get(serial)
  if (!device) throw Errors.deviceNotFound(serial)
  return device
}

export function listStoredDevices(): DeviceInfo[] {
  return [...devices.values()].sort((a, b) => (a.status === 'connected' ? -1 : 1) - (b.status === 'connected' ? -1 : 1))
}

export function upsertStored(device: DeviceInfo) {
  devices.set(device.serial, device)
  if (devices.size > MAX_STORED_DEVICES) {
    const oldest = [...devices.values()].sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))[0]
    if (oldest) devices.delete(oldest.serial)
  }
}

export function removeStored(serial: string) {
  devices.delete(serial)
  bus.emit('device:remove', serial)
}

export function setDeviceStatus(serial: string, status: DeviceStatus) {
  const info = devices.get(serial)
  if (info) {
    info.status = status
    info.authorized = status === 'connected'
    bus.emit('device:update', serial, info)
    bus.emit('device:status', serial, status)
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null

export function startDeviceMonitoring() {
  if (refreshTimer) return
  refreshTimer = setInterval(() => {
    refreshAll().catch(() => {})
  }, 15_000)
  refreshAll().catch(() => {})
}

export function stopDeviceMonitoring() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

export async function connectDevice(serial: string, address?: string): Promise<DeviceInfo> {
  const target = address ?? (serial.includes(':') ? serial : undefined)
  if (target) {
    await adb.connectDevice(target)
  }
  await refreshDevice(serial)
  return requireDevice(serial)
}

export async function disconnectDevice(serial: string) {
  await adb.disconnectDevice(serial)
  const info = devices.get(serial)
  if (info) {
    setDeviceStatus(serial, 'disconnected')
  }
}

export async function removeDevice(serial: string) {
  try {
    await adb.disconnectDevice(serial)
  } catch {
    /* ignore */
  }
  removeStored(serial)
}