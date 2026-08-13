import { serialSchema, pidSchema } from '../../../../utils/validation'
import * as processManager from '../../../../services/process-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const pid = validate(pidSchema, event.context.params?.pid)
  await processManager.killProcess(serial, pid)
  return { killed: pid }
})