import { serialSchema } from '../../../utils/validation'
import * as deviceManager from '../../../services/device-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const device = await deviceManager.refreshDevice(serial)
  return device
})
