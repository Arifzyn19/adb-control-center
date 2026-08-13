import { z } from 'zod'
import { serialSchema, packageSchema } from '../../../../utils/validation'
import * as appManager from '../../../../services/app-manager'

const schema = z.object({
  package: packageSchema,
  enabled: z.boolean(),
})

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Invalid request.')
  await appManager.setAppEnabled(serial, parsed.data.package, parsed.data.enabled)
  return { package: parsed.data.package, enabled: parsed.data.enabled }
})
