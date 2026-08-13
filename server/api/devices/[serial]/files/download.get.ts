import { z } from 'zod'
import { serialSchema } from '../../../../utils/validation'
import * as fileManager from '../../../../services/file-manager'

const pathSchema = z.string().max(1024)

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const query = getQuery(event)
  const parsed = pathSchema.safeParse(query.path)
  if (!parsed.success) throw Errors.invalid('Invalid file path.')
  const stats = await fileManager.readFileStats(serial, parsed.data)
  if (stats.type === 'dir') throw Errors.invalid('Cannot download a directory.')
  const stream = fileManager.streamPull(serial, parsed.data)
  return sendDownload(event, stream, {
    type: 'application/octet-stream',
    filename: stats.name,
    size: stats.size,
  })
})
