import { serialSchema } from '../../../utils/validation'
import * as adb from '../../../services/adb'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const props = await adb.getProperties(serial)
  const sorted = Object.entries(props)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key))
  return sorted
})