import { serialSchema, packageSchema } from '../../../../utils/validation'
import * as appManager from '../../../../services/app-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const pkg = validate(packageSchema, event.context.params?.package)
  const app = await appManager.getAppDetails(serial, pkg)
  return app
})
