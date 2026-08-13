import { z } from 'zod'
import { serialSchema, logLevelSchema } from '../../../../utils/validation'
import * as logcatService from '../../../../services/logcat'

const querySchema = z.object({
  level: logLevelSchema.optional().default('ALL'),
})

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  const level = parsed.success ? parsed.data.level : 'ALL'
  const text = await logcatService.dumpLogcat(serial, { level })
  return { text }
})