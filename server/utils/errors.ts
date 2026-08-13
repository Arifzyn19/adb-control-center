export class AppError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const Errors = {
  unauthorized: (message = 'Authentication required') => new AppError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Permission denied') => new AppError('FORBIDDEN', message, 403),
  notFound: (message = 'Resource not found') => new AppError('NOT_FOUND', message, 404),
  invalid: (message = 'Invalid input', details?: unknown) => new AppError('INVALID_INPUT', message, 400, details),
  deviceNotFound: (serial: string) =>
    new AppError('DEVICE_NOT_FOUND', `Device "${serial}" is no longer connected.`, 404),
  deviceOffline: (serial: string) =>
    new AppError('DEVICE_OFFLINE', `Device "${serial}" is offline or unavailable.`, 409),
  deviceUnauthorized: (serial: string) =>
    new AppError('DEVICE_UNAUTHORIZED', `Device "${serial}" requires ADB authorization.`, 409),
  adbUnavailable: (message = 'ADB server is not available.') => new AppError('ADB_UNAVAILABLE', message, 500),
  rateLimited: () => new AppError('RATE_LIMITED', 'Too many requests, please slow down.', 429),
  tooManyDevices: () => new AppError('TOO_MANY_DEVICES', 'Device limit reached.', 400),
  pairingFailed: (message = 'Pairing failed.') => new AppError('PAIRING_FAILED', message, 400),
  commandTimeout: (message = 'Command timed out.') => new AppError('COMMAND_TIMEOUT', message, 504),
  commandFailed: (message: string, details?: unknown) => new AppError('COMMAND_FAILED', message, 422, details),
  notFoundFile: (path: string) => new AppError('FILE_NOT_FOUND', `Path not found: ${path}`, 404),
  invalidPath: (message = 'Invalid path.') => new AppError('INVALID_PATH', message, 400),
}

export function toErrorPayload(error: unknown) {
  if (error instanceof AppError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
  }
  const err = error as Error
  return {
    success: false,
    code: 'INTERNAL_ERROR',
    message: err?.message || 'An unexpected error occurred.',
  }
}

export function assertApi(error: unknown) {
  if (error instanceof AppError) {
    return new Response(JSON.stringify(toErrorPayload(error)), {
      status: error.status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return new Response(JSON.stringify(toErrorPayload(error)), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })
}

export function ok<T>(data: T, status = 200) {
  return new Response(JSON.stringify({ success: true, ...(data ? { data } : {}) }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}