import { z } from 'zod'
import * as deviceManager from '../../services/device-manager'

const schema = z.object({
  address: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/, 'Invalid host:port address'),
})

export default defineApi(async (event) => {
  requireSession(event)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Enter a valid device address like 192.168.1.20:5555.')
  const { address } = parsed.data

  if (!rateLimit(`connect:${ipOf(event)}`, 30)) throw Errors.rateLimited()

  const device = await deviceManager.connectDevice(address, address)
  return device
})
