export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/')) return
  if (path === '/api/auth/login' || path === '/api/health') return

  const token = getBearerToken(event)
  const session = getAuthSession(token)
  if (!session) {
    return assertApi(Errors.unauthorized())
  }

  event.context.session = session

  if (event.method !== 'GET') {
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    if (!rateLimit(`api:${ip}`, 240)) {
      return assertApi(Errors.rateLimited())
    }
  }
})
