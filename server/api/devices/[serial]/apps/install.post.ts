import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serialSchema } from '../../../../utils/validation'
import * as appManager from '../../../../services/app-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw Errors.invalid('No file provided.')
  const file = parts.find((p) => p.name === 'file')
  if (!file || !file.data?.length) throw Errors.invalid('Missing APK file.')
  if (!file.filename?.toLowerCase().endsWith('.apk')) throw Errors.invalid('Only .apk files are supported.')

  const sizeLimit = 512 * 1024 * 1024
  if (file.data.length > sizeLimit) throw Errors.invalid('APK is too large.')

  const dir = await mkdtemp(join(tmpdir(), 'acc-'))
  const target = join(dir, `${randomBytes(6).toString('hex')}.apk`)
  try {
    await writeFile(target, file.data)
    const replace = parts.find((p) => p.name === 'replace')?.data?.toString() === 'true'
    const grantPermissions = parts.find((p) => p.name === 'grant')?.data?.toString() === 'true'
    const result = await appManager.installApk(serial, target, { replace, grantPermissions })
    return { installed: true, detail: result }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})
