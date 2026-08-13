import { z } from 'zod'
import * as pairing from '../../services/pairing'

const schema = z.object({
  address: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/, 'Invalid host:port address'),
  code: z.string().min(6).max(64),
})

export default defineApi(async (event) => {
  requireSession(event)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Enter a valid device address and pairing code.')
  if (!rateLimit(`pair-manual:${ipOf(event)}`, 20)) throw Errors.rateLimited()

  const result = await pairing.pairManual(parsed.data.address, parsed.data.code)
  return result
})
