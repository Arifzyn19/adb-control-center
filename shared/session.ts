export interface Session {
  token: string
  createdAt: number
  expiresAt: number
  ip?: string
}