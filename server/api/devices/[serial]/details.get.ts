import type { DeviceDetail } from '../../../../shared/types'
import { serialSchema } from '../../../utils/validation'
import * as deviceManager from '../../../services/device-manager'
import * as adb from '../../../services/adb'
import { collectStorage, parseSizeToBytes } from '../../../services/device-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const base = await deviceManager.refreshDevice(serial)
  if (base.status !== 'connected') throw Errors.deviceOffline(serial)

  const props = await adb.getProperties(serial)
  const [batteryRes, meminfoRes, cpuRes, uptimeRes, displayRes] = await Promise.allSettled([
    adb.shell(serial, 'dumpsys battery'),
    adb.shell(serial, 'cat /proc/meminfo'),
    adb.shell(serial, 'cat /proc/cpuinfo'),
    adb.shell(serial, 'cat /proc/uptime'),
    adb.shell(serial, 'dumpsys display'),
  ])

  const bat = batteryRes.status === 'fulfilled' ? batteryRes.value.stdout : ''
  const mem = meminfoRes.status === 'fulfilled' ? meminfoRes.value.stdout : ''
  const cpu = cpuRes.status === 'fulfilled' ? cpuRes.value.stdout : ''
  const uptime = uptimeRes.status === 'fulfilled' ? uptimeRes.value.stdout : ''
  const display = displayRes.status === 'fulfilled' ? displayRes.value.stdout : ''

  const getBat = (k: string) => bat.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null
  const memTotal = Number(mem.match(/^MemTotal:\s+(\d+)\s*kB/m)?.[1] || 0) * 1024
  const memFree = Number(mem.match(/^MemFree:\s+(\d+)\s*kB/m)?.[1] || 0) * 1024
  const memAvailable = Number(mem.match(/^MemAvailable:\s+(\d+)\s*kB/m)?.[1] || 0) * 1024
  const cpuCores = (cpu.match(/^processor\s*:/gm) || []).length
  const cpuUsagePct = await readCpuUsage(serial).catch(() => null)
  const storage = await collectStorage(serial)

  const res = display.match(/(\d+)x(\d+)/)
  const screenResolution = res ? `${res[1]} × ${res[2]}` : null

  const detail: DeviceDetail = {
    ...base,
    batteryHealth: getBat('health') || 'unknown',
    batteryTechnology: getBat('technology') || 'unknown',
    batteryTempC: getBat('temperature') ? Number(getBat('temperature')) / 10 : base.batteryTempC,
    displaySize: null as unknown as string,
    displayDensity: props['ro.sf.lcd_density'] || props['ro.sf.lcd_density'] || '',
    kernelVersion: (await adb.shell(serial, 'uname -r', { timeoutMs: 8000 }).catch(() => null))?.stdout.trim() || '',
    securityPatch: props['ro.build.version.security_patch'] || '',
    bootloader: props['ro.bootloader'] || '',
    baseband: props['ro.build.version.base_os'] || props['gsm.version.baseband'] || '',
    uptime: uptime.trim().split(/\s+/)[0] || '',
    cpuCores,
    cpuUsagePct,
    ramUsedBytes: memTotal - memAvailable,
    storageTotalBytesDetail: storage.total,
    storageUsedBytesDetail: storage.used,
    screenResolution: screenResolution || '',
    locale: props['persist.sys.locale'] || props['ro.product.locale'] || '',
    timezone: props['persist.sys.timezone'] || '',
  }

  return detail
})

async function readCpuUsage(serial: string): Promise<number | null> {
  const res = await adb.shell(serial, 'top -b -n 1 | head -n 5', { timeoutMs: 10_000 })
  const m = res.stdout.match(/([\d.]+)%\s+user/)
  const m2 = res.stdout.match(/([\d.]+)%\s+system/)
  if (m && m2) return Math.round((Number(m[1]) + Number(m[2])) * 10) / 10
  if (m) return Number(m[1])
  return null
}