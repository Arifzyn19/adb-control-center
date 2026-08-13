import { z } from 'zod'
import { serialSchema } from '../../../../utils/validation'
import * as fileManager from '../../../../services/file-manager'

const schema = z.object({
  from: z.string().max(1024),
  to: z.string().max(1024),
})

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Invalid paths.')
  await fileManager.renamePath(serial, parsed.data.from, parsed.data.to)
  return { renamed: { from: parsed.data.from, to: parsed.data.to } }
})