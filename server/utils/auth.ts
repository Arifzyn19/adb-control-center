import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

interface Session {
  token: string
  createdAt: number
  expiresAt: number
  ip?: string
}

const sessions = new Map<string, Session>()
const TTL_MS = 8 * 60 * 60 * 1000

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

export function createSession(ip?: string) {
  const raw = randomBytes(32).toString('hex')
  const token = hashToken(raw)
  const now = Date.now()
  sessions.set(token, {
    token,
    createdAt: now,
    expiresAt: now + TTL_MS,
    ip,
  })
  pruneSessions()
  return { raw, token }
}

export function getAuthSession(token?: string | null): Session | null {
  if (!token) return null
  const session = sessions.get(hashToken(token))
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    sessions.delete(hashToken(token))
    return null
  }
  return session
}

export function revokeSession(token: string) {
  sessions.delete(hashToken(token))
}

export function getBearerToken(event: H3Event): string | undefined {
  const header = getHeader(event, 'authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const query = getQuery(event)
  if (typeof query.token === 'string' && query.token.length > 0) return query.token
  return undefined
}

export function requireAuth(event: H3Event): Session {
  const token = getBearerToken(event)
  const session = getAuthSession(token)
  if (!session) throw Errors.unauthorized()
  return session
}

function pruneSessions() {
  const now = Date.now()
  for (const [token, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(token)
  }
  if (sessions.size > 500) {
    const sorted = [...sessions.values()].sort((a, b) => a.expiresAt - b.expiresAt)
    for (const s of sorted.slice(0, sorted.length - 250)) sessions.delete(s.token)
  }
}

export const sessionStore = {
  get size() {
    return sessions.size
  },
  get ip() {
    return sessions
  },
}
