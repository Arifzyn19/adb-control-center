export default defineApi(async (event) => {
  const session = requireSession(event)
  return {
    authenticated: true,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    ip: session.ip,
  }
})
