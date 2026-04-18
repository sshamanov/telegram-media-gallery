const isDev = import.meta.env.DEV

export const DEBUG_MEDIA_SIZES = import.meta.env.VITE_DEBUG_MEDIA_SIZES === 'true'
export const DEBUG_VIEWER = import.meta.env.VITE_DEBUG_VIEWER === 'true'

type DebugLevel = 'debug' | 'warn'

const recentDebugEvents = new Map<string, number>()

function shouldRelay(event: string, data: unknown): boolean {
  const key = `${event}:${JSON.stringify(data)}`
  const now = Date.now()
  const last = recentDebugEvents.get(key) ?? 0

  if (now - last < 250) {
    return false
  }

  recentDebugEvents.set(key, now)
  return true
}

function relayDebug(level: DebugLevel, args: unknown[]): void {
  if (!isDev || !DEBUG_VIEWER || typeof fetch !== 'function') {
    return
  }

  const [event, ...rest] = args
  const payload = {
    level,
    event: typeof event === 'string' ? event : 'log',
    data: rest.length <= 1 ? (rest[0] ?? null) : rest,
    timestamp: new Date().toISOString(),
  }

  if (!shouldRelay(payload.event, payload.data)) {
    return
  }

  void fetch('/__debug', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // best-effort diagnostics only
  })
}

export function debugLog(...args: unknown[]): void {
  if (isDev) {
    console.debug('[telegram-gallery]', ...args)
    relayDebug('debug', args)
  }
}

export function debugWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn('[telegram-gallery]', ...args)
    relayDebug('warn', args)
  }
}
