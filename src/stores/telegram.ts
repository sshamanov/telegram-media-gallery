import { writable } from 'svelte/store'
import type { AuthState, SessionSnapshot } from '../types/telegram'
import { getTelegramAdapter, setTelegramAdapter, setTelegramApiCredentials } from '../lib/telegram/adapter'
import { mtcuteAdapter } from '../lib/telegram/mtcute'

setTelegramAdapter(mtcuteAdapter)
setTelegramApiCredentials(
  localStorage.getItem('telegram.apiId') ?? import.meta.env.VITE_TELEGRAM_API_ID ?? '',
  localStorage.getItem('telegram.apiHash') ?? import.meta.env.VITE_TELEGRAM_API_HASH ?? '',
)

export const authState = writable<AuthState>('idle')
export const authStatus = writable('Connect to Telegram')
export const phoneCodeHash = writable<string | null>(null)
export const phone = writable('')
export const session = writable<SessionSnapshot>({
  phone: localStorage.getItem('phone') ?? undefined,
  session: localStorage.getItem('session'),
})

export const telegramAdapter = getTelegramAdapter()
