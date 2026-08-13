import { z } from 'zod'
import { serialSchema, appTypeSchema } from '../../../utils/validation'
import * as appManager from '../../../services/app-manager'

const querySchema = z.object({
  type: appTypeSchema.optional().default('all'),
  search: z.string().max(200).optional().default(''),
  sort: z.enum(['label', 'package', 'size']).optional().default('label'),
})

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  const { type, search, sort } = parsed.success ? parsed.data : { type: 'all' as const, search: '', sort: 'label' as const }

  let apps = await appManager.listApps(serial)

  if (type === 'user') apps = apps.filter((a) => !a.isSystem)
  else if (type === 'system') apps = apps.filter((a) => a.isSystem)

  if (search) {
    const q = search.toLowerCase()
    apps = apps.filter((a) => a.package.toLowerCase().includes(q) || a.label.toLowerCase().includes(q))
  }

  if (sort === 'package') apps.sort((a, b) => a.package.localeCompare(b.package))
  else if (sort === 'size') apps.sort((a, b) => b.sizeBytes - a.sizeBytes)

  return apps
})
