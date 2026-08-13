import { serialSchema } from '../../../utils/validation'
import * as adb from '../../../services/adb'

export default defineApi(async (event) => {
  requireSession(event)
  const serial = validate(serialSchema, event.context.params?.serial)
  const buffer = await adb.execOut(serial, 'screencap -p')
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-store',
    },
  })
})