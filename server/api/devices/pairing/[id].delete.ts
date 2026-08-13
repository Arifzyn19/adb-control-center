import { z } from 'zod'
import * as pairing from '../../../services/pairing'

const idSchema = z.string().regex(/^[a-f0-9]{16}$/)

export default defineApi(async (event) => {
  requireSession(event)
  const id = validate(idSchema, event.context.params?.id)
  pairing.cancelPairingSession(id)
  return { cancelled: true }
})
