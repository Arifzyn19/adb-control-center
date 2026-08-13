import { startDeviceMonitoring, stopDeviceMonitoring } from '../services/device-manager'
import { stopAllSessions } from '../services/logcat'

export default defineNitroPlugin(() => {
  startDeviceMonitoring()

  const shutdown = () => {
    stopDeviceMonitoring()
    stopAllSessions()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})
