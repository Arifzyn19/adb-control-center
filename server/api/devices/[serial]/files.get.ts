import { z } from 'zod'
import { serialSchema } from '../../../utils/validation'
import * as fileManager from '../../../services/file-manager'

const pathSchema = z.string().max(1024)

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const query = getQuery(event)
  const path = pathSchema.safeParse(query.path).success ? (query.path as string) : '/sdcard'
  const result = await fileManager.listDirectory(serial, path)
  return result
})
