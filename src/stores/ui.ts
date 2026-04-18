import { writable } from 'svelte/store'
import { persisted } from './persisted'
import type { ToastMessage } from '../types/telegram'

export const isOffline = writable(false)
export const toasts = writable<ToastMessage[]>([])
export const selectionHintDismissed = persisted('selectionHintDismissed', false)

const TOAST_AUTO_CLOSE_MS = 1000 // 1 second

export function pushToast(partial: Omit<ToastMessage, 'id'>): void {
  const id = crypto.randomUUID()
  toasts.update((items) => [...items, { ...partial, id }])

  if (partial.dismissible && partial.kind !== 'error') {
    window.setTimeout(() => dismissToast(id), TOAST_AUTO_CLOSE_MS)
  }
}

export function dismissToast(id: string): void {
  toasts.update((items) => items.filter((item) => item.id !== id))
}
