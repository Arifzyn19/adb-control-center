import { createReadStream } from 'node:fs'
import { mkdtemp, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serialSchema, packageSchema } from '../../../../utils/validation'
import * as appManager from '../../../../services/app-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const query = getQuery(event)
  const pkg = validate(packageSchema, query.package)
  const detail = await appManager.getAppDetails(serial, pkg)

  const dir = await mkdtemp(join(tmpdir(), 'acc-apk-'))
  const dest = join(dir, `${detail.package}.apk`)
  try {
    await appManager.extractApk(serial, pkg, dest)
    const info = await stat(dest)
    const stream = createReadStream(dest)
    return sendDownload(event, stream, {
      type: 'application/vnd.android.package-archive',
      filename: `${detail.package}.apk`,
      size: info.size,
      onEnd: () => rm(dir, { recursive: true, force: true }).catch(() => {}),
    })
  } catch (err) {
    rm(dir, { recursive: true, force: true }).catch(() => {})
    throw err
  }
})