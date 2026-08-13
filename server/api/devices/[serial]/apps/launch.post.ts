import { serialSchema, packageSchema } from '../../../../utils/validation'
import * as appManager from '../../../../services/app-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const body = await readJson<{ package?: string }>(event)
  const pkg = validate(packageSchema, body.package)
  const detail = await appManager.launchApp(serial, pkg)
  return { launched: pkg, detail }
})
