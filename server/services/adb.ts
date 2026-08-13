import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { Errors } from '../utils/errors'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
  timedOut: boolean
}

export interface AdbDeviceLine {
  serial: string
  state: string
  product?: string
  model?: string
  device?: string
  transportId?: string
}

export interface AdbOptions {
  timeoutMs?: number
  maxBuffer?: number
}

const DEFAULT_TIMEOUT = 15_000
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024

let binaryPath: string | null = null

export function getAdbBinary(): string {
  if (binaryPath) return binaryPath
  const configured = useRuntimeConfig().adbPath
  binaryPath = configured || 'adb'
  return binaryPath
}

export function setAdbBinary(path: string) {
  binaryPath = path
}

export function execAdb(args: string[], options: AdbOptions = {}): Promise<ExecResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER

  return new Promise((resolve, reject) => {
    const child = spawn(getAdbBinary(), args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    const finish = (code: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code, timedOut })
    }

    child.stdout?.on('data', (d) => {
      stdout += d.toString()
      if (stdout.length > maxBuffer) {
        stdout = stdout.slice(stdout.length - maxBuffer)
      }
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const sysErr = err as NodeJS.ErrnoException
      if (sysErr.code === 'ENOENT') {
        reject(
          Errors.adbUnavailable(
            `ADB binary not found at "${getAdbBinary()}". Install adb and ensure it is on PATH, or set the adbPath config option.`,
          ),
        )
      } else {
        reject(err)
      }
    })
    child.on('close', (code) => {
      finish(code ?? -1)
    })
  })
}

export function spawnAdb(args: string[], options: { detached?: boolean } = {}) {
  return spawn(getAdbBinary(), args, {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: options.detached,
  })
}

export async function adbServerReady(): Promise<void> {
  const res = await execAdb(['start-server'], { timeoutMs: 10_000 })
  if (res.code !== 0 && !res.stderr.includes('daemon already running')) {
    throw Errors.adbUnavailable(res.stderr.trim() || 'adb start-server failed')
  }
}

export async function listDevices(): Promise<AdbDeviceLine[]> {
  await adbServerReady()
  const res = await execAdb(['devices', '-l'])
  const devices: AdbDeviceLine[] = []
  const lines = res.stdout.split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.startsWith('List of devices')) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2) continue
    const device: AdbDeviceLine = { serial: parts[0]!, state: parts[1]! }
    for (const kv of parts.slice(2)) {
      const idx = kv.indexOf(':')
      if (idx === -1) continue
      const key = kv.slice(0, idx)
      const value = kv.slice(idx + 1)
      if (key === 'product') device.product = value
      else if (key === 'model') device.model = value
      else if (key === 'device') device.device = value
      else if (key === 'transport_id') device.transportId = value
    }
    devices.push(device)
  }
  return devices
}

export async function getDeviceState(serial: string): Promise<string | null> {
  const devices = await listDevices()
  const found = devices.find((d) => d.serial === serial)
  return found?.state ?? null
}

export async function connectDevice(address: string): Promise<{ serial: string; state: string }> {
  await adbServerReady()
  const res = await execAdb(['connect', address], { timeoutMs: 30_000 })
  const stdout = res.stdout.trim()
  if (stdout.includes('cannot connect')) {
    throw Errors.commandFailed(stdout || 'Connection failed')
  }
  if (stdout.includes('failed to authenticate')) {
    throw Errors.deviceUnauthorized(address)
  }
  return { serial: address, state: stdout.includes('already connected') ? 'device' : 'device' }
}

export async function disconnectDevice(serial: string) {
  await execAdb(['disconnect', serial], { timeoutMs: 10_000 })
}

export async function shell(serial: string, command: string, options: AdbOptions = {}): Promise<ExecResult> {
  const state = await getDeviceState(serial)
  if (state === null) throw Errors.deviceNotFound(serial)
  if (state === 'offline') throw Errors.deviceOffline(serial)
  if (state === 'unauthorized') throw Errors.deviceUnauthorized(serial)
  if (state !== 'device') throw Errors.deviceOffline(serial)
  const res = await execAdb(['-s', serial, 'shell', command], options)
  return res
}

export async function shellSplit(serial: string, args: string[], options: AdbOptions = {}): Promise<ExecResult> {
  const state = await getDeviceState(serial)
  if (state === null) throw Errors.deviceNotFound(serial)
  if (state === 'offline') throw Errors.deviceOffline(serial)
  if (state === 'unauthorized') throw Errors.deviceUnauthorized(serial)
  if (state !== 'device') throw Errors.deviceOffline(serial)
  const res = await execAdb(['-s', serial, 'shell', ...args], options)
  return res
}

export function spawnShell(serial: string) {
  return spawnAdb(['-s', serial, 'shell'])
}

export function spawnShellCommand(serial: string, command: string) {
  return spawnAdb(['-s', serial, 'shell', command])
}

export function spawnLogcat(serial: string, args: string[]) {
  return spawnAdb(['-s', serial, 'logcat', ...args])
}

export function spawnReverse(serial: string, args: string[]) {
  return spawnAdb(['-s', serial, 'reverse', ...args])
}

export async function getProperties(serial: string): Promise<Record<string, string>> {
  const res = await shell(serial, 'getprop', { timeoutMs: 15_000 })
  const props: Record<string, string> = {}
  for (const line of res.stdout.split(/\r?\n/)) {
    const m = line.match(/^\[([^\]]*)\]\s*:\s*\[(.*)\]$/)
    if (m) props[m[1]!] = m[2]!
  }
  return props
}

export async function getProp(serial: string, key: string): Promise<string | undefined> {
  const res = await shell(serial, `getprop ${key}`, { timeoutMs: 10_000 })
  return res.stdout.trim() || undefined
}

export async function screenshotsEnabled(serial: string): Promise<void> {
  await getDeviceState(serial)
}

export async function checkDeviceAvailable(serial: string) {
  const state = await getDeviceState(serial)
  if (state === null) throw Errors.deviceNotFound(serial)
  if (state === 'unauthorized') throw Errors.deviceUnauthorized(serial)
  if (state !== 'device') throw Errors.deviceOffline(serial)
}

export function decodeExecBuffer(buffer: Buffer): Buffer {
  return buffer
}

export async function waitForBoot(serial: string, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await shell(serial, 'getprop sys.boot_completed', { timeoutMs: 5_000 }).catch(() => null)
    if (res && res.stdout.trim() === '1') return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

export async function execOut(serial: string, command: string): Promise<Buffer> {
  await checkDeviceAvailable(serial)
  const child = spawnAdb(['-s', serial, 'exec-out', command])
  const chunks: Buffer[] = []
  child.stdout.on('data', (d) => chunks.push(d))
  let stderr = ''
  child.stderr.on('data', (d) => (stderr += d.toString()))
  const [code] = await once(child, 'close')
  if (code !== 0) throw Errors.commandFailed(stderr.trim() || 'Command failed')
  return Buffer.concat(chunks)
}

export async function execIn(serial: string, data: Buffer, command: string): Promise<void> {
  await checkDeviceAvailable(serial)
  const child = spawnAdb(['-s', serial, 'exec-in', command])
  child.stdin.write(data)
  child.stdin.end()
  const [code] = await once(child, 'close')
  if (code !== 0) throw Errors.commandFailed('Command failed')
}

export { once }
