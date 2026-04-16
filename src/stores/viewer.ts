import { writable } from 'svelte/store'

export interface PendingViewerRoute {
  dialogId: string
  messageId: number
}

export const pendingViewerRoute = writable<PendingViewerRoute | null>(null)

export function clearPendingViewerRoute(): void {
  pendingViewerRoute.set(null)
}