import { z } from 'zod'
import * as pairing from '../../../services/pairing'

const idSchema = z.string().regex(/^[a-f0-9]{16}$/)

export default defineApi(async (event) => {
  requireSession(event)
  const id = validate(idSchema, event.context.params?.id)
  const session = pairing.getPairingSession(id)
  if (!session) throw Errors.notFound('Pairing session not found or expired.')
  return {
    status: session.status,
    error: session.error,
    device: session.device,
    qrPayload: session.qrPayload,
  }
})
