import * as deviceManager from '../services/device-manager'
import { getSessionInfo } from '../services/logcat'

export default defineApi(async () => {
  const devices = deviceManager.listStoredDevices()
  const online = devices.filter((d) => d.status === 'connected').length
  const offline = devices.filter((d) => d.status !== 'connected').length
  const sessions = getSessionInfo()
  const logEvents = sessions.reduce((acc, s) => acc + s.buffer, 0)

  return {
    totalDevices: devices.length,
    onlineDevices: online,
    offlineDevices: offline,
    activeLogcatSessions: sessions.length,
    logEvents,
    recentlyConnected: [...devices]
      .sort((a, b) => b.lastConnected.localeCompare(a.lastConnected))
      .slice(0, 6),
  }
})