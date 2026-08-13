import { z } from 'zod'

export default defineApi(async (event) => {
  const body = await readJson<{ token?: string }>(event)
  const schema = z.object({ token: z.string().min(4).max(512) })
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw Errors.invalid('Enter your access token.')

  const ip = ipOf(event)
  if (!rateLimit(`login:${ip}`, 5)) throw Errors.rateLimited()

  const expected = useRuntimeConfig().auth.token
  const provided = parsed.data.token

  const matches = safeEqual(provided, expected)
  if (!matches) {
    if (!rateLimit(`login:${ip}:fail`, 10)) throw Errors.rateLimited()
    throw Errors.unauthorized('Invalid access token.')
  }

  const session = createSession(ip)
  return { token: session.raw }
})

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}