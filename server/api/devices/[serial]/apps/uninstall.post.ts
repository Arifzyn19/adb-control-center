import { z } from 'zod'
import { serialSchema } from '../../../../utils/validation'
import * as appManager from '../../../../services/app-manager'

const schema = z.object({
  serial: serialSchema,
  package: z.string().regex(/^[A-Za-z0-9._-]{1,255}$/, 'Invalid package name'),
})

export default defineApi(async (event) => {
  requireSession(event)
  const body = await readJson(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Invalid package name.')
  const { serial, package: pkg } = parsed.data
  await appManager.uninstallApp(serial, pkg)
  appManager.invalidateDumpsysCache(serial)
  return { uninstalled: pkg }
})
