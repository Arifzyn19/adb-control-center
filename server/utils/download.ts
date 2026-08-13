import type { Readable } from 'node:stream'
import type { H3Event } from 'h3'
import { sendStream as h3SendStream } from 'h3'

export async function sendDownload(
  event: H3Event,
  stream: Readable,
  options: { type: string; filename: string; size?: number; onEnd?: () => void } = { type: 'application/octet-stream', filename: 'download.bin' },
) {
  setHeader(event, 'content-type', options.type)
  setHeader(event, 'content-disposition', `attachment; filename="${options.filename.replace(/"/g, '')}"`)
  if (options.size !== undefined) setHeader(event, 'content-length', options.size)
  stream.on('close', () => options.onEnd?.())
  stream.on('end', () => options.onEnd?.())
  stream.on('error', () => options.onEnd?.())
  return h3SendStream(event, stream)
}