const TOKEN_KEY = 'acc.token'

type TokenRef = ReturnType<typeof useState<string | null>>
type AuthRef = ReturnType<typeof useState<boolean>>

let state: { token: TokenRef; authenticated: AuthRef } | undefined

function getState() {
  if (!state) {
    state = {
      token: useState<string | null>('auth-token', () => {
        if (import.meta.client) {
          return localStorage.getItem(TOKEN_KEY)
        }
        return null
      }),
      authenticated: useState<boolean>('auth-authenticated', () => false),
    }
  }
  return state
}

export function useAuth() {
  const { token, authenticated } = getState()

  function setToken(value: string | null) {
    token.value = value
    if (import.meta.client) {
      if (value) localStorage.setItem(TOKEN_KEY, value)
      else localStorage.removeItem(TOKEN_KEY)
    }
  }

  async function login(value: string): Promise<void> {
    const data = await $fetch<{ success: true; data: { token: string } }>('/api/auth/login', {
      method: 'POST',
      body: { token: value },
    })
    setToken(data.data.token)
    authenticated.value = true
  }

  async function logout() {
    if (token.value) {
      try {
        await $fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() })
      } catch {
        /* ignore */
      }
    }
    setToken(null)
    authenticated.value = false
  }

  async function check(): Promise<boolean> {
    if (!token.value) {
      authenticated.value = false
      return false
    }
    try {
      await $fetch('/api/auth/me', { headers: authHeaders() })
      authenticated.value = true
      return true
    } catch {
      authenticated.value = false
      return false
    }
  }

  return {
    token,
    authenticated,
    setToken,
    login,
    logout,
    check,
  }
}

export function authHeaders(): Record<string, string> {
  const t = getState().token.value
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export function wsUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(path, window.location.origin)
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', getState().token.value || '')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('content-type', 'application/json')
  }
  headers.set('Authorization', `Bearer ${getState().token.value || ''}`)

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401) {
    const auth = useAuth()
    auth.setToken(null)
    getState().authenticated.value = false
    throw new ApiError('UNAUTHORIZED', 'Session expired. Sign in again.', 401)
  }

  if (res.headers.get('content-type')?.includes('application/json')) {
    const body = await res.json().catch(() => null)
    if (!res.ok || body?.success === false) {
      throw new ApiError(body?.code || 'REQUEST_FAILED', body?.message || 'Request failed', res.status)
    }
    return body.data as T
  }

  if (!res.ok) {
    throw new ApiError('REQUEST_FAILED', `Request failed (${res.status})`, res.status)
  }

  return undefined as T
}