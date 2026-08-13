export default defineApi(async (event) => {
  const token = getBearerToken(event)
  if (token) revokeSession(token)
  return { ok: true }
})
