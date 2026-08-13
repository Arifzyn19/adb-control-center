import * as pairing from '../../services/pairing'

export default defineApi(async (event) => {
  requireSession(event)
  const count = pairing.listSessions().length
  const max = useRuntimeConfig().maxDevices
  if (count >= max) throw Errors.tooManyDevices()

  if (!rateLimit(`pair:${ipOf(event)}`, 10)) throw Errors.rateLimited()

  const session = pairing.createPairingSession()
  return {
    id: session.id,
    qrPayload: session.qrPayload,
    serviceName: session.serviceName,
    status: session.status,
  }
})
