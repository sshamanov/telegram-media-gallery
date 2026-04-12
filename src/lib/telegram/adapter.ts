import type { Dialog, Message, TgMedia, UploadMode } from '../../types/telegram'

export interface MessagePage {
  messages: Message[]
  nextOffset: { id: number; date: number } | null
  totalMessages: number
}

export interface TelegramAdapter {
  sendCode(phone: string): Promise<{ phoneCodeHash: string }>
  signIn(phone: string, code: string, hash: string): Promise<'ok' | '2fa_required'>
  signIn2FA(password: string): Promise<void>
  startQRLogin(onPasswordRequired: () => Promise<string>): AsyncIterable<{ token: string; expires: number }>
  reconnect(session: string): Promise<boolean>
  logout(): Promise<void>
  getSession(): string | null
  getDialogs(opts?: { limit?: number; offsetDate?: number }): Promise<Dialog[]>
  getMessages(dialogId: string, opts: { limit: number; offset?: { id: number; date: number } | null }): Promise<MessagePage>
  downloadThumbnail(media: TgMedia): Promise<Uint8Array | null>
  downloadFull(media: TgMedia, onProgress?: (pct: number) => void, abortSignal?: AbortSignal): Promise<Uint8Array>
  uploadAndSend(dialogId: string, file: File, mode: UploadMode, onProgress?: (pct: number) => void, abortSignal?: AbortSignal): Promise<void>
  forwardMessages(toId: string, fromId: string, msgIds: number[]): Promise<void>
}

let currentAdapter: TelegramAdapter | null = null
let storedApiId = localStorage.getItem('telegram.apiId') ?? import.meta.env.VITE_TELEGRAM_API_ID ?? ''
let storedApiHash = localStorage.getItem('telegram.apiHash') ?? import.meta.env.VITE_TELEGRAM_API_HASH ?? ''
let useMock = localStorage.getItem('telegram.useMock') === 'true'

export function setTelegramAdapter(adapter: TelegramAdapter): void {
  currentAdapter = adapter
}

export function getTelegramAdapter(): TelegramAdapter {
  if (!currentAdapter) {
    throw new Error('Telegram adapter has not been initialized')
  }

  return currentAdapter
}

export function setUseMock(enabled: boolean): void {
  useMock = enabled
  localStorage.setItem('telegram.useMock', enabled ? 'true' : 'false')
}

export function getUseMock(): boolean {
  return useMock
}

export function setTelegramApiCredentials(apiId: string, apiHash: string): void {
  storedApiId = apiId.trim()
  storedApiHash = apiHash.trim()

  localStorage.setItem('telegram.apiId', storedApiId)
  localStorage.setItem('telegram.apiHash', storedApiHash)
}

export function getTelegramApiCredentials(): { apiId: string; apiHash: string } {
  return {
    apiId: storedApiId,
    apiHash: storedApiHash,
  }
}
