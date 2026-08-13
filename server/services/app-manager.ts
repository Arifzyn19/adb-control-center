import type { AppInfo } from '../../shared/types'
import * as adb from './adb'
import * as deviceManager from './device-manager'

interface DumpsysPkg {
  versionName: string
  versionCode: number | null
  targetSdk: number | null
  minSdk: number | null
  firstInstallTime: string | null
  lastUpdateTime: string | null
  codePath: string
  dataDir: string
  isSystem: boolean
  label: string
  requestedPermissions: string[]
}

const dumpsysCache = new Map<string, Map<string, DumpsysPkg>>()
let dumpsysCachedFor = new Map<string, number>()

const CACHE_TTL = 60_000

async function getDumpsysMap(serial: string, force = false): Promise<Map<string, DumpsysPkg>> {
  const cached = dumpsysCache.get(serial)
  const last = dumpsysCachedFor.get(serial) || 0
  if (!force && cached && Date.now() - last < CACHE_TTL) return cached

  const res = await adb.shell(serial, 'dumpsys package', { timeoutMs: 30_000, maxBuffer: 64 * 1024 * 1024 })
  const map = new Map<string, DumpsysPkg>()
  const blocks = res.stdout.split(/^  Package \[/m)

  for (const block of blocks.slice(1)) {
    const pkg = block.slice(0, block.indexOf(']')).trim()
    if (!pkg) continue
    const entry: DumpsysPkg = {
      versionName: '',
      versionCode: null,
      targetSdk: null,
      minSdk: null,
      firstInstallTime: null,
      lastUpdateTime: null,
      codePath: '',
      dataDir: '',
      isSystem: false,
      label: '',
      requestedPermissions: [],
    }
    const inPerm = (line: string) => {
      const m = line.match(/^      ([a-zA-Z0-9_.]+)$/)
      if (m) entry.requestedPermissions.push(m[1]!)
    }
    for (const line of block.split(/\r?\n/)) {
      let m: RegExpMatchArray | null
      if ((m = line.match(/^\s+versionName=(.*)$/))) entry.versionName = m[1]!.trim()
      else if ((m = line.match(/^\s+versionCode=(\d+)/))) entry.versionCode = Number(m[1]!)
      else if ((m = line.match(/^\s+versionCode=.* targetSdk=(\d+)/))) entry.targetSdk = Number(m[1]!)
      else if ((m = line.match(/^\s+versionCode=.* minSdk=(\d+)/))) entry.minSdk = Number(m[1]!)
      else if ((m = line.match(/^\s+minSdk=(\d+)/))) entry.minSdk = Number(m[1]!)
      else if ((m = line.match(/^\s+targetSdk=(\d+)/))) entry.targetSdk = Number(m[1]!)
      else if ((m = line.match(/^\s+firstInstallTime=(.+)$/))) entry.firstInstallTime = m[1]!.trim()
      else if ((m = line.match(/^\s+lastUpdateTime=(.+)$/))) entry.lastUpdateTime = m[1]!.trim()
      else if ((m = line.match(/^\s+codePath=(.*)$/))) entry.codePath = m[1]!.trim()
      else if ((m = line.match(/^\s+dataDir=(.*)$/))) entry.dataDir = m[1]!.trim()
      else if ((m = line.match(/^\s+pkgFlags=\[(.*)\]/))) entry.isSystem = m[1]!.split('|').map((s) => s.trim()).includes('SYSTEM')
      else if ((m = line.match(/^\s+applicationInfo.*labelRes/))) entry.label = ''
      else if (line.trim() === 'requested permissions:') entry.requestedPermissions = []
      else if (entry.requestedPermissions.length >= 0 && /^      [a-zA-Z0-9_.]+$/.test(line.trim())) inPerm(line)
      else if ((m = line.match(/^\s+label=(.*)$/))) entry.label = m[1]!.trim()
    }
    map.set(pkg, entry)
  }

  dumpsysCache.set(serial, map)
  dumpsysCachedFor.set(serial, Date.now())
  return map
}

async function getBaseLists(serial: string): Promise<{
  packages: Map<string, { uid: number | null; path: string }>
  user: Set<string>
  system: Set<string>
  disabled: Set<string>
}> {
  const [baseRes, userRes, systemRes, disabledRes] = await Promise.all([
    adb.shell(serial, 'pm list packages -f -U', { timeoutMs: 15_000 }),
    adb.shell(serial, 'pm list packages -3', { timeoutMs: 10_000 }),
    adb.shell(serial, 'pm list packages -s', { timeoutMs: 10_000 }),
    adb.shell(serial, 'pm list packages -d', { timeoutMs: 10_000 }),
  ])
  const packages = new Map<string, { uid: number | null; path: string }>()
  for (const line of baseRes.stdout.split(/\r?\n/)) {
    const m = line.match(/^package:(.*?)=([^\s]+)\s*(\d+)?$/)
    if (m) packages.set(m[2]!, { uid: m[3] ? Number(m[3]) : null, path: m[1]! })
  }
  const collect = (out: string) => new Set(out.split(/\r?\n/).map((l) => l.replace(/^package:/, '')).filter(Boolean))
  return {
    packages,
    user: collect(userRes.stdout),
    system: collect(systemRes.stdout),
    disabled: collect(disabledRes.stdout),
  }
}

export async function listApps(serial: string): Promise<AppInfo[]> {
  deviceManager.requireDevice(serial)
  const [lists, details] = await Promise.all([getBaseLists(serial), getDumpsysMap(serial)])

  const apps: AppInfo[] = []
  for (const [pkg, base] of lists.packages) {
    const detail = details.get(pkg)
    apps.push({
      package: pkg,
      label: detail?.label || pkg,
      versionName: detail?.versionName || '',
      versionCode: detail?.versionCode ?? null,
      uid: base.uid ?? null,
      apkPath: base.path || detail?.codePath || '',
      isSystem: lists.system.has(pkg) || detail?.isSystem || false,
      isEnabled: !lists.disabled.has(pkg),
      isUpdatedSystem: false,
      installedFor: 'user 0',
      firstInstallTime: detail?.firstInstallTime ?? null,
      lastUpdateTime: detail?.lastUpdateTime ?? null,
      sizeBytes: 0,
      dataSizeBytes: 0,
      targetSdk: detail?.targetSdk ?? null,
      minSdk: detail?.minSdk ?? null,
      permissions: detail?.requestedPermissions || [],
    })
  }
  apps.sort((a, b) => a.label.localeCompare(b.label))
  return apps
}

export async function getAppDetails(serial: string, pkg: string): Promise<AppInfo> {
  const apps = await listApps(serial)
  const app = apps.find((a) => a.package === pkg)
  if (!app) throw Errors.notFound(`Package "${pkg}" not found.`)

  const res = await adb.shell(serial, `dumpsys package ${pkg}`, { timeoutMs: 15_000, maxBuffer: 16 * 1024 * 1024 })
  const sizes = await adb.shell(serial, `du -s -k ${app.apkPath}`, { timeoutMs: 10_000 }).catch(() => null)
  const sizeBytes = sizes ? (Number(sizes.stdout.trim().split(/\s+/)[0]) || 0) * 1024 : 0
  const dataRes = await adb.shell(serial, `du -s -k /data/data/${pkg}`, { timeoutMs: 10_000 }).catch(() => null)
  const dataSizeBytes = dataRes ? (Number(dataRes.stdout.trim().split(/\s+/)[0]) || 0) * 1024 : 0

  return {
    ...app,
    sizeBytes,
    dataSizeBytes,
    permissions: [...new Set([...app.permissions, ...parsePermissions(res.stdout)])],
  }
}

function parsePermissions(out: string): string[] {
  const perms: string[] = []
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s+([a-zA-Z0-9_.]+\.[a-zA-Z0-9_.]+)\s*: granted=true/)
    if (m) perms.push(m[1]!)
  }
  return perms
}

export async function installApk(serial: string, apkPath: string, opts: { replace?: boolean; grantPermissions?: boolean } = {}) {
  const args = ['-s', serial, 'install']
  if (opts.replace) args.push('-r')
  if (opts.grantPermissions) args.push('-g')
  args.push('-d', '-t', apkPath)
  const res = await adb.execAdb(args, { timeoutMs: 120_000, maxBuffer: 4 * 1024 * 1024 })
  const out = (res.stdout + res.stderr).trim()
  if (res.code !== 0 || /Failure \[|error:/i.test(out)) {
    throw Errors.commandFailed(cleanInstallError(out) || 'APK installation failed', out)
  }
  return out
}

function cleanInstallError(out: string) {
  const m = out.match(/(?:Failure \[.*?\]|error:\s*.*)/)
  return m?.[0] ?? null
}

export async function uninstallApp(serial: string, pkg: string, keepData = false) {
  const args = ['-s', serial, 'uninstall']
  if (keepData) args.push('-k')
  args.push(pkg)
  const res = await adb.execAdb(args, { timeoutMs: 30_000 })
  const out = (res.stdout + res.stderr).trim()
  if (res.code !== 0 || !out.includes('Success')) {
    throw Errors.commandFailed(out || 'Uninstall failed', out)
  }
  return out
}

export async function launchApp(serial: string, pkg: string) {
  const res = await adb.shell(serial, `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, { timeoutMs: 15_000 })
  if (res.stdout.includes('monkey aborted')) throw Errors.commandFailed('Application could not be launched', res.stdout)
  return res.stdout.trim()
}

export async function forceStopApp(serial: string, pkg: string) {
  await adb.shell(serial, `am force-stop ${pkg}`, { timeoutMs: 10_000 })
}

export async function clearAppData(serial: string, pkg: string) {
  const res = await adb.shell(serial, `pm clear ${pkg}`, { timeoutMs: 30_000 })
  if (!res.stdout.includes('Success')) throw Errors.commandFailed('Failed to clear application data', res.stdout)
}

export async function clearAppCache(serial: string, pkg: string) {
  const res = await adb.shell(serial, `pm clear --cache-only ${pkg}`, { timeoutMs: 30_000 })
  if (!res.stdout.includes('Success') && !res.stdout.includes('Cache') && res.code !== 0) {
    throw Errors.commandFailed('Failed to clear application cache', res.stdout)
  }
}

export async function setAppEnabled(serial: string, pkg: string, enabled: boolean) {
  const res = await adb.shell(serial, enabled ? `pm enable ${pkg}` : `pm disable-user ${pkg}`, { timeoutMs: 15_000 })
  if (res.code !== 0 && !res.stdout.includes('already')) {
    throw Errors.commandFailed(`Failed to ${enabled ? 'enable' : 'disable'} application`, res.stdout)
  }
}

export async function extractApk(serial: string, pkg: string, destPath: string) {
  const app = await getAppDetails(serial, pkg)
  const apkPath = app.apkPath
  if (!apkPath) throw Errors.notFound(`No APK path found for "${pkg}".`)
  await adb.execAdb(['-s', serial, 'pull', apkPath, destPath], { timeoutMs: 120_000 })
}

export async function reinstallApp(serial: string, pkg: string) {
  const app = await getAppDetails(serial, pkg)
  const apkPath = app.apkPath
  if (!apkPath) throw Errors.notFound(`No APK path found for "${pkg}".`)
  const res = await adb.execAdb(['-s', serial, 'install', '-r', '-d', '-t', apkPath], { timeoutMs: 120_000 })
  const out = (res.stdout + res.stderr).trim()
  if (res.code !== 0 || /Failure \[|error:/i.test(out)) throw Errors.commandFailed(out || 'Reinstall failed', out)
  return out
}

export function invalidateDumpsysCache(serial: string) {
  dumpsysCache.delete(serial)
}