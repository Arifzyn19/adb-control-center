import { serialSchema } from '../../../../utils/validation'
import * as logcatService from '../../../../services/logcat'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  await logcatService.clearDeviceLogcat(serial)
  return { cleared: true }
})