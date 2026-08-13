import { serialSchema } from '../../utils/validation'
import * as deviceManager from '../../services/device-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const body = await readJson<{ serial?: string }>(event)
  const serial = validate(serialSchema, body.serial)
  await deviceManager.disconnectDevice(serial)
  return { disconnected: serial }
})
