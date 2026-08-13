import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { serialSchema } from '../../../../utils/validation'
import * as fileManager from '../../../../services/file-manager'

const pathSchema = z.string().max(1024)

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw Errors.invalid('No file provided.')
  const file = parts.find((p) => p.name === 'file')
  const remoteField = parts.find((p) => p.name === 'path')
  if (!file || !file.data?.length) throw Errors.invalid('Missing file data.')
  const remote = remoteField?.data?.toString('utf8') ?? '/sdcard'
  const parsedPath = pathSchema.safeParse(remote)
  if (!parsedPath.success) throw Errors.invalid('Invalid destination path.')

  const sizeLimit = 512 * 1024 * 1024
  if (file.data.length > sizeLimit) throw Errors.invalid('File is too large.')

  const dir = await mkdtemp(join(tmpdir(), 'acc-up-'))
  const local = join(dir, `${randomBytes(8).toString('hex')}-${file.filename || 'upload'}`)
  try {
    await writeFile(local, file.data)
    await fileManager.pushFile(serial, local, parsedPath.data)
    return { uploaded: parsedPath.data }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})
