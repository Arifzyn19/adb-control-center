import { serialSchema } from '../../../utils/validation'
import * as processManager from '../../../services/process-manager'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const processes = await processManager.listProcesses(serial)
  return processes
})