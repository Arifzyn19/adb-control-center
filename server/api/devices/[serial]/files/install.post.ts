import { z } from 'zod'
import { serialSchema } from '../../../../utils/validation'
import * as fileManager from '../../../../services/file-manager'

const schema = z.object({
  path: z.string().max(1024).refine((p) => p.endsWith('.apk'), 'Only .apk files can be installed'),
})

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid(parsed.error.issues[0]?.message || 'Invalid path.')
  const result = await fileManager.installApkFromDevice(serial, parsed.data.path)
  return { installed: parsed.data.path, detail: result }
})