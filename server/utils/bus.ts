import { EventEmitter } from 'node:events'
import type { LogEntry } from '../../shared/types'

type Events = {
  'device:update': (serial: string, device: unknown) => void
  'device:remove': (serial: string) => void
  'device:status': (serial: string, status: string) => void
  'logcat:entry': (serial: string, entry: LogEntry) => void
}

class AppBus extends EventEmitter {
  override on<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.on(event as string, listener as (...args: unknown[]) => void)
  }

  override off<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.off(event as string, listener as (...args: unknown[]) => void)
  }

  override emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    return super.emit(event as string, ...args)
  }
}

export const bus = new AppBus()
