import { writable } from 'svelte/store'
import type { AuthState, SessionSnapshot } from '../types/telegram'
import type { TelegramAdapter } from '../lib/telegram/adapter'
import { getTelegramAdapter, setTelegramAdapter, setTelegramApiCredentials, setUseMock } from '../lib/telegram/adapter'
import { mtcuteAdapter } from '../lib/telegram/mtcute'
import { mockAdapter } from '../lib/telegram/mock'
import { pushToast } from './ui'
import { clearDialogSnapshot, resetDialogsState } from './dialogs'
import { clearDialogCache } from '../lib/cache/indexeddb'

// For testing: default to mock adapter if no API credentials are set or if env var is set
const hasApiCredentials = localStorage.getItem('telegram.apiId') || import.meta.env.VITE_TELEGRAM_API_ID
const envUseMockValue = import.meta.env.VITE_USE_MOCK_ADAPTER
const envUseMock = envUseMockValue === 'true' || envUseMockValue === '1' || envUseMockValue === 'True' || envUseMockValue === 'TRUE'

// If env var is explicitly set (true or false), use it. Otherwise default based on credentials
let useMock: boolean
if (envUseMockValue !== undefined) {
  // Environment variable is explicitly set
  useMock = envUseMock
  setUseMock(useMock) // Update module variable
} else {
  // No environment variable, default based on credentials
  useMock = !hasApiCredentials
  setUseMock(useMock)
}

setTelegramAdapter(useMock ? mockAdapter : mtcuteAdapter)
setTelegramApiCredentials(
  localStorage.getItem('telegram.apiId') ?? import.meta.env.VITE_TELEGRAM_API_ID ?? '',
  localStorage.getItem('telegram.apiHash') ?? import.meta.env.VITE_TELEGRAM_API_HASH ?? '',
)

export type ReconnectState = 'idle' | 'reconnecting' | 'failed'

export const authState = writable<AuthState>('idle')
export const authStatus = writable('Connect to Telegram')
export const phoneCodeHash = writable<string | null>(null)
export const phone = writable('')
export const session = writable<SessionSnapshot>({
  phone: localStorage.getItem('phone') ?? undefined,
  session: localStorage.getItem('session'),
})
export const reconnectState = writable<ReconnectState>('idle')

export function getCurrentAdapter(): TelegramAdapter {
  return getTelegramAdapter()
}

// For backward compatibility during migration
export const telegramAdapter = getTelegramAdapter()

export const useMockAdapter = writable(useMock)

export function switchToMockAdapter(enabled: boolean): void {
  setUseMock(enabled)
  useMockAdapter.set(enabled)
  
  if (enabled) {
    setTelegramAdapter(mockAdapter)
  } else {
    setTelegramAdapter(mtcuteAdapter)
  }
  
  localStorage.removeItem('session')
  localStorage.removeItem('phone')
  clearDialogSnapshot()
  void clearDialogCache()
  resetDialogsState()
  authState.set('idle')
  session.set({ session: null })
  pushToast({ 
    kind: 'info', 
    text: `Switched to ${enabled ? 'mock' : 'real'} Telegram adapter`, 
    dismissible: true 
  })
}

const MAX_RETRIES = 3
let retryCount = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Called when a disconnect is detected (e.g. from mtcute event or failed API call).
 * Enters reconnecting state and attempts up to MAX_RETRIES times with backoff.
 */
export async function handleDisconnect(): Promise<void> {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }

  reconnectState.set('reconnecting')
  retryCount = 0
  await attemptReconnect()
}

async function attemptReconnect(): Promise<void> {
  const snap = localStorage.getItem('session')
  if (!snap) {
    reconnectState.set('idle')
    return
  }

  try {
    const connected = await getTelegramAdapter().reconnect(snap)
    if (connected) {
      reconnectState.set('idle')
      authState.set('connected')
      retryCount = 0
      return
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('AUTH_KEY_UNREGISTERED') || message.includes('SESSION_REVOKED')) {
      handleSessionExpired()
      return
    }
  }

  retryCount++
  if (retryCount >= MAX_RETRIES) {
    reconnectState.set('failed')
    return
  }

  // Exponential backoff: 2s, 4s, 8s
  const delay = Math.pow(2, retryCount) * 1000
  retryTimer = setTimeout(() => void attemptReconnect(), delay)
}

/** Called by the ReconnectBanner "Try again" button */
export function retryReconnect(): void {
  retryCount = 0
  reconnectState.set('reconnecting')
  void attemptReconnect()
}

/** Called when session is found to be expired */
export function handleSessionExpired(): void {
  localStorage.removeItem('session')
  localStorage.removeItem('phone')
  clearDialogSnapshot()
  void clearDialogCache()
  resetDialogsState()
  reconnectState.set('idle')
  authState.set('idle')
  session.set({ session: null })
  pushToast({ kind: 'error', text: 'Session expired — please log in again', dismissible: true })
}

/**
 * Wrap any Telegram adapter call to catch server errors and session expiry.
 * Re-throws after handling so callers can still react to the failure.
 */
export async function withTelegramErrorHandling<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('AUTH_KEY_UNREGISTERED') || message.includes('SESSION_REVOKED')) {
      handleSessionExpired()
    } else if (message.includes('INTERNAL_SERVER_ERROR') || message.includes('500')) {
      pushToast({ kind: 'error', text: 'Telegram error — try again', dismissible: true })
    }
    throw error
  }
}
