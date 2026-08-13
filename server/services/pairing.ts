import { randomBytes, randomInt } from 'node:crypto'
import { Bonjour } from 'bonjour-service'
import * as adb from './adb'
import * as deviceManager from './device-manager'

export type PairingStep = 'ready' | 'browsing' | 'paired' | 'connecting' | 'connected' | 'failed' | 'cancelled' | 'timeout'

export interface PairingSession {
  id: string
  serviceName: string
  password: string
  qrPayload: string
  status: PairingStep
  device?: {
    name: string
    serial: string
    ip: string
    port: number
  }
  error?: string
  createdAt: number
  expiresAt: number
  cleanup: () => void
}

const sessions = new Map<string, PairingSession>()
const PAIRING_TTL_MS = 5 * 60 * 1000

const QR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function randString(length: number, alphabet: string) {
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}

function sessionTTL(id: string) {
  const session = sessions.get(id)
  return session && Date.now() < session.expiresAt
}

function startCleanupTimer() {
  setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now > session.expiresAt) {
        session.cleanup()
        sessions.delete(id)
      }
    }
  }, 30_000).unref()
}
startCleanupTimer()

function runPair(host: string, port: number, code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = adb.spawnAdb(['pair', `${host}:${port}`, code])
    let out = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (out += d.toString()))
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(Errors.pairingFailed('Pairing timed out.'))
    }, 30_000)
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && /success/i.test(out)) resolve(out)
      else if (/already paired/i.test(out)) resolve(out)
      else reject(Errors.pairingFailed(out.trim() || 'Pairing failed. The device may have rejected the code.'))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(Errors.pairingFailed(`Failed to start pairing: ${err.message}`))
    })
  })
}

export function createPairingSession(): PairingSession {
  const id = randomBytes(8).toString('hex')
  const password = randString(10, PASSWORD_ALPHABET)
  const serviceName = `studio-${randString(10, QR_ALPHABET)}`
  const qrPayload = `WIFI:T:ADB;S:${serviceName};P:${password};;`

  let bonjour: Bonjour | null = null
  let browser: ReturnType<Bonjour['find']> | null = null
  let settled = false

  const session: PairingSession = {
    id,
    serviceName,
    password,
    qrPayload,
    status: 'browsing',
    createdAt: Date.now(),
    expiresAt: Date.now() + PAIRING_TTL_MS,
    cleanup: () => {
      settled = true
      if (browser) browser.stop()
      if (bonjour) bonjour.destroy()
    },
  }

  sessions.set(id, session)

  try {
    bonjour = new Bonjour()
    browser = bonjour.find({ type: 'adb-tls-pairing' })

    browser.on('up', (service) => {
      if (settled || service.name !== serviceName) return
      session.status = 'paired'
      const host = service.host || service.addresses?.[0]
      if (!host) {
        session.status = 'failed'
        session.error = 'Could not resolve device address from mDNS.'
        return
      }
      const port = service.port
      runPair(host, port, password)
        .then(async () => {
          if (settled) return
          session.status = 'connecting'
          const connectPort = await discoverConnectPort(host, 15_000)
          const targetPort = connectPort || port
          const serial = `${host}:${targetPort}`
          try {
            const res = await adb.connectDevice(serial)
            if (settled) return
            session.status = 'connected'
            session.device = {
              name: host,
              serial,
              ip: host,
              port: targetPort,
            }
            deviceManager.storeConnectingDevice(serial, host)
            const props = await adb.getProperties(serial).catch(() => null)
            if (props) {
              session.device.name = props['ro.product.marketname'] || props['ro.product.model'] || host
            }
            deviceManager.refreshStoredDevice(serial)
          } catch (err) {
            if (!settled) {
              session.status = 'failed'
              session.error = err instanceof Error ? err.message : 'Connection failed.'
            }
          }
        })
        .catch((err) => {
          if (!settled) {
            session.status = 'failed'
            session.error = err instanceof Error ? err.message : 'Pairing failed.'
          }
        })
    })

    browser.on('error', (err) => {
      if (!settled) {
        session.status = 'failed'
        session.error = `mDNS error: ${err instanceof Error ? err.message : String(err)}`
      }
    })
  } catch (err) {
    session.status = 'failed'
    session.error = `Unable to start mDNS: ${err instanceof Error ? err.message : String(err)}`
  }

  return session
}

function discoverConnectPort(host: string, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    let bonjour: Bonjour | null = null
    const timer = setTimeout(() => {
      if (browser) browser.stop()
      if (bonjour) bonjour.destroy()
      resolve(null)
    }, timeoutMs)
    let browser: ReturnType<Bonjour['find']> | null = null
    try {
      bonjour = new Bonjour()
      browser = bonjour.find({ type: 'adb-tls-connect' })
      browser.on('up', (service) => {
        const svcHost = service.host || service.addresses?.[0]
        if (!svcHost) return
        const sameHost = svcHost === host || service.addresses?.includes(host)
        if (sameHost) {
          clearTimeout(timer)
          browser?.stop()
          bonjour?.destroy()
          resolve(service.port)
        }
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

export function getPairingSession(id: string): PairingSession | undefined {
  const session = sessions.get(id)
  if (session && !sessionTTL(id)) {
    session.cleanup()
    sessions.delete(id)
    return undefined
  }
  return session
}

export function cancelPairingSession(id: string) {
  const session = sessions.get(id)
  if (session) {
    session.status = 'cancelled'
    session.cleanup()
    sessions.delete(id)
  }
}

export async function pairManual(address: string, code: string): Promise<{ serial: string; status: string }> {
  const [host, portStr] = address.split(':')
  const port = Number(portStr)
  if (!host || !port) throw Errors.invalid('Invalid address.')
  const out = await runPair(host, port, code)
  const serial = `${host}:${port}`
  deviceManager.storeConnectingDevice(serial, host)
  const res = await adb.connectDevice(serial)
  deviceManager.refreshStoredDevice(serial)
  return { serial, status: res.state }
}

export function listSessions() {
  return [...sessions.keys()]
}
