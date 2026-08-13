import type { FileEntry } from '../../shared/types'
import * as adb from './adb'
import * as deviceManager from './device-manager'

const ALLOWED_ROOTS = ['/sdcard', '/storage', '/data/media/0', '/mnt', '/data/local/tmp']
const MAX_PATH_LENGTH = 1024

export function safeRemotePath(input: unknown, { allowRoot = true }: { allowRoot?: boolean } = {}): string {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_PATH_LENGTH) {
    throw Errors.invalidPath('Path must be a valid absolute string.')
  }
  if (input.includes('\0')) throw Errors.invalidPath('Path contains invalid characters.')
  if (!input.startsWith('/')) throw Errors.invalidPath('Path must be absolute.')
  const parts = input.split('/').filter(Boolean)
  if (parts.some((p) => p === '..')) throw Errors.invalidPath('Path traversal is not allowed.')
  const normalized = '/' + parts.join('/')
  if (!allowRoot) {
    if (!ALLOWED_ROOTS.some((root) => normalized === root || normalized.startsWith(root + '/'))) {
      throw Errors.invalidPath('Path is outside allowed storage roots.')
    }
  }
  return normalized
}

function parseLsLine(line: string): FileEntry | null {
  const m = line.match(/^([\-bcdlps])[rwxsStT\-]{9}\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(.+?)\s+(\S+)$/)
  if (!m) return null
  const [, kind, owner, group, sizeStr, dateStr, namePart] = m
  const isLink = kind === 'l'
  let name = namePart!
  let linkTarget: string | undefined
  if (isLink) {
    const idx = namePart!.indexOf(' -> ')
    if (idx !== -1) {
      name = namePart!.slice(0, idx)
      linkTarget = namePart!.slice(idx + 4)
    }
  }
  return {
    name,
    path: '',
    type: kind === 'd' ? 'dir' : kind === 'l' ? 'symlink' : kind === '-' ? 'file' : kind === 'b' ? 'block' : kind === 'c' ? 'char' : kind === 'p' ? 'pipe' : 'sock',
    size: Number(sizeStr) || 0,
    permissions: m[0].slice(1, 10),
    owner: owner!,
    group: group!,
    modified: dateStr!.trim(),
    linkTarget,
  }
}

export async function listDirectory(serial: string, path: string): Promise<{ path: string; parent: string | null; entries: FileEntry[] }> {
  deviceManager.requireDevice(serial)
  const safePath = safeRemotePath(path, { allowRoot: false })
  const res = await adb.shell(serial, `ls -la ${quotePath(safePath)}`, { timeoutMs: 10_000 })

  const entries: FileEntry[] = []
  for (const line of res.stdout.split(/\r?\n/)) {
    if (!line || line.startsWith('total ') || line.startsWith('ls: ')) continue
    const entry = parseLsLine(line)
    if (!entry) continue
    if (entry.name === '.' || entry.name === '..') continue
    entry.path = joinPath(safePath, entry.name)
    entries.push(entry)
  }

  const parent = safePath === '/' ? null : safePath.split('/').slice(0, -1).join('/') || '/'
  return { path: safePath, parent, entries }
}

export function joinPath(base: string, name: string): string {
  return base === '/' ? '/' + name : base + '/' + name
}

function quotePath(path: string): string {
  return "'" + path.replace(/'/g, "'\\''") + "'"
}

export async function readFileStats(serial: string, path: string): Promise<FileEntry> {
  const safePath = safeRemotePath(path)
  const res = await adb.shell(serial, `ls -la ${quotePath(safePath)}`, { timeoutMs: 10_000 })
  for (const line of res.stdout.split(/\r?\n/)) {
    const entry = parseLsLine(line)
    if (entry && entry.name === safePath.split('/').pop()) {
      entry.path = safePath
      return entry
    }
  }
  throw Errors.notFoundFile(safePath)
}

export async function createDirectory(serial: string, path: string) {
  const safePath = safeRemotePath(path)
  const res = await adb.shell(serial, `mkdir -p ${quotePath(safePath)}`, { timeoutMs: 10_000 })
  if (res.code !== 0 && res.stderr) throw Errors.commandFailed(res.stderr.trim() || 'Failed to create directory', res.stderr)
}

export async function removePath(serial: string, path: string) {
  const safePath = safeRemotePath(path)
  if (safePath === '/') throw Errors.invalidPath('Cannot delete the root directory.')
  const res = await adb.shell(serial, `rm -rf ${quotePath(safePath)}`, { timeoutMs: 15_000 })
  if (res.code !== 0) throw Errors.commandFailed(res.stderr.trim() || 'Failed to delete', res.stderr)
}

export async function renamePath(serial: string, from: string, to: string) {
  const safeFrom = safeRemotePath(from)
  const safeTo = safeRemotePath(to)
  const res = await adb.shell(serial, `mv ${quotePath(safeFrom)} ${quotePath(safeTo)}`, { timeoutMs: 10_000 })
  if (res.code !== 0) throw Errors.commandFailed(res.stderr.trim() || 'Failed to rename', res.stderr)
}

export async function pushFile(serial: string, localPath: string, remotePath: string) {
  const safeRemote = safeRemotePath(remotePath)
  const res = await adb.execAdb(['-s', serial, 'push', localPath, safeRemote], { timeoutMs: 120_000, maxBuffer: 4 * 1024 * 1024 })
  if (res.code !== 0) {
    throw Errors.commandFailed((res.stdout + res.stderr).trim() || 'Upload failed', (res.stdout + res.stderr).trim())
  }
}

export async function pullFile(serial: string, remotePath: string, localPath: string) {
  const safeRemote = safeRemotePath(remotePath)
  const res = await adb.execAdb(['-s', serial, 'pull', safeRemote, localPath], { timeoutMs: 120_000, maxBuffer: 4 * 1024 * 1024 })
  if (res.code !== 0) {
    throw Errors.commandFailed((res.stdout + res.stderr).trim() || 'Download failed', (res.stdout + res.stderr).trim())
  }
}

export function streamPull(serial: string, remotePath: string) {
  const safeRemote = safeRemotePath(remotePath)
  return adb.spawnAdb(['-s', serial, 'exec-out', `cat ${quotePath(safeRemote)}`]).stdout
}

export function streamPush(serial: string, remotePath: string) {
  const safeRemote = safeRemotePath(remotePath)
  return adb.spawnAdb(['-s', serial, 'exec-in', `tee ${quotePath(safeRemote)}`])
}

export async function installApkFromDevice(serial: string, apkPath: string) {
  const safePath = safeRemotePath(apkPath)
  const res = await adb.execAdb(['-s', serial, 'install', '-r', '-d', '-t', safePath], { timeoutMs: 120_000, maxBuffer: 4 * 1024 * 1024 })
  const out = (res.stdout + res.stderr).trim()
  if (res.code !== 0 || /Failure \[|error:/i.test(out)) throw Errors.commandFailed(out || 'Install failed', out)
  return out
}