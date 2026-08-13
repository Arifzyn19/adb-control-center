import { z } from 'zod'
import { serialSchema } from '../../../../utils/validation'
import * as fileManager from '../../../../services/file-manager'

const schema = z.object({
  path: z.string().max(1024),
})

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Invalid path.')
  await fileManager.removePath(serial, parsed.data.path)
  return { deleted: parsed.data.path }
})
