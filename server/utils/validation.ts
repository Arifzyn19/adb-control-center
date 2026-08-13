import { z } from 'zod'

const SERIAL_RE = /^[A-Za-z0-9._:-]{1,64}$/
const PACKAGE_RE = /^[A-Za-z0-9._-]{1,255}$/
const PID_RE = /^\d{1,8}$/
const ADDRESS_RE = /^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/

export const serialSchema = z.string().regex(SERIAL_RE, 'Invalid device serial')
export const packageSchema = z.string().regex(PACKAGE_RE, 'Invalid package name')
export const pidSchema = z.coerce.number().int().min(1).max(99999999)
export const addressSchema = z.string().regex(ADDRESS_RE, 'Invalid host:port address')
export const pairingCodeSchema = z.string().length(6).regex(/^\d{6}$/, 'Pairing code must be 6 digits')

export const logLevelSchema = z.enum(['ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'])
export const appTypeSchema = z.enum(['all', 'user', 'system'])
export const sortSchema = z.enum(['cpu', 'memory', 'pid', 'name'])

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw Errors.invalid(result.error.issues[0]?.message || 'Invalid input', result.error.flatten())
  }
  return result.data
}

export const appActionSchema = z.object({
  serial: serialSchema,
  package: packageSchema,
})