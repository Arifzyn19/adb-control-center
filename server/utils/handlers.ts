import type { H3Event } from 'h3'
import type { Session } from '../../shared/session'

export function defineApi<T>(handler: (event: H3Event) => Promise<T> | T) {
  return defineEventHandler(async (event) => {
    try {
      const data = await handler(event)
      return ok(data)
    } catch (error) {
      return assertApi(error)
    }
  })
}

export function requireSession(event: H3Event): Session {
  const session = event.context.session as Session | undefined
  if (!session) throw Errors.unauthorized()
  return session
}

export function getSessionSafe(event: H3Event): Session | null {
  return (event.context.session as Session | undefined) ?? null
}

export async function readJson<T>(event: H3Event): Promise<T> {
  const body = await readBody(event).catch(() => undefined)
  return (body ?? {}) as T
}

export function ipOf(event: H3Event): string {
  const fwd = getHeader(event, 'x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown'
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}