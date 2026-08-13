import { z } from 'zod'
import { serialSchema, packageSchema } from '../../../../utils/validation'
import * as appManager from '../../../../services/app-manager'

const schema = z.object({
  package: packageSchema,
  target: z.enum(['data', 'cache']),
})

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Invalid request.')
  if (parsed.data.target === 'data') {
    await appManager.clearAppData(serial, parsed.data.package)
  } else {
    await appManager.clearAppCache(serial, parsed.data.package)
  }
  return { cleared: parsed.data.package, target: parsed.data.target }
})
