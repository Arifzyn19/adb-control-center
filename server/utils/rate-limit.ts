interface Bucket {
  timestamps: number[]
}

const WINDOW_MS = 60_000
const store = new Map<string, Bucket>()

export function rateLimit(key: string, max: number): boolean {
  const now = Date.now()
  let bucket = store.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    store.set(key, bucket)
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS)
  if (bucket.timestamps.length >= max) {
    return false
  }
  bucket.timestamps.push(now)
  return true
}

export function clearRateLimits() {
  store.clear()
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of store) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS)
    if (bucket.timestamps.length === 0) store.delete(key)
  }
}, 60_000).unref()
