export type ConnectionType = 'wireless' | 'usb' | 'emulator' | 'unknown'
export type DeviceStatus = 'connected' | 'offline' | 'unauthorized' | 'disconnected' | 'connecting'

export interface DeviceInfo {
  serial: string
  name: string
  manufacturer: string
  model: string
  androidVersion: string
  sdkVersion: number | null
  buildFingerprint: string
  abi: string[]
  cpu: string
  ramTotalBytes: number
  storageTotalBytes: number
  storageUsedBytes: number
  batteryPercent: number | null
  batteryTempC: number | null
  batteryStatus: string
  ipAddress: string | null
  connectionType: ConnectionType
  status: DeviceStatus
  authorized: boolean
  lastSeen: string
  lastConnected: string
  firstSeen: string
  product?: string
}

export interface DeviceDetail extends DeviceInfo {
  batteryHealth: string
  batteryTechnology: string
  displaySize: string
  displayDensity: string
  kernelVersion: string
  securityPatch: string
  bootloader: string
  baseband: string
  uptime: string
  cpuCores: number
  cpuUsagePct: number | null
  ramUsedBytes: number
  storageTotalBytesDetail: number
  storageUsedBytesDetail: number
  screenResolution: string
  locale: string
  timezone: string
}

export interface AppInfo {
  package: string
  label: string
  versionName: string
  versionCode: number | null
  uid: number | null
  apkPath: string
  isSystem: boolean
  isEnabled: boolean
  isUpdatedSystem: boolean
  installedFor: string
  firstInstallTime: string | null
  lastUpdateTime: string | null
  sizeBytes: number
  dataSizeBytes: number
  targetSdk: number | null
  minSdk: number | null
  permissions: string[]
}

export interface ProcessInfo {
  pid: number
  ppid: number | null
  name: string
  user: string
  cpuPct: number
  memBytes: number
  memPct: number
}

export interface LogEntry {
  timestamp: string
  level: string
  tag: string
  pid: number | null
  tid: number | null
  message: string
  raw: string
}

export interface FileEntry {
  name: string
  path: string
  type: 'dir' | 'file' | 'symlink' | 'block' | 'char' | 'pipe' | 'sock' | 'unknown'
  size: number
  permissions: string
  owner: string
  group: string
  modified: string
  linkTarget?: string
}

export interface DeviceStat {
  label: string
  value: string
  icon?: string
}

export type LogLevel = 'ALL' | 'VERBOSE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'