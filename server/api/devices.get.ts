import * as deviceManager from '../services/device-manager'
import { bus } from '../utils/bus'

export default defineApi(async (event) => {
  requireSession(event)
  const devices = await deviceManager.refreshAll()
  return devices
})
