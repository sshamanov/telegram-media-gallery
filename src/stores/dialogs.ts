import { derived, get, writable } from 'svelte/store'
import type { Dialog } from '../types/telegram'
import { persisted } from './persisted'

export const allDialogs = writable<Dialog[]>([])
export const galleryIds = persisted<string[]>('galleryIds', [])
export const dialogSearch = writable('')

export type DialogDataSource = 'empty' | 'live' | 'snapshot'

export interface DialogSnapshot {
  version: number
  updatedAt: number | null
  dialogs: Dialog[]
}

const DIALOG_SNAPSHOT_VERSION = 1

const emptyDialogSnapshot: DialogSnapshot = {
  version: DIALOG_SNAPSHOT_VERSION,
  updatedAt: null,
  dialogs: [],
}

const rawDialogSnapshot = persisted<DialogSnapshot>('dialogs.snapshot', emptyDialogSnapshot)

function sanitizeDialog(dialog: Dialog): Dialog {
  return {
    id: dialog.id,
    title: dialog.title,
    kind: dialog.kind,
    subtitle: dialog.subtitle,
    avatarUrl: null,
    username: dialog.username ?? null,
    lastMessageDate: dialog.lastMessageDate ?? null,
  }
}

function normalizeDialogSnapshot(snapshot: DialogSnapshot): DialogSnapshot {
  if (snapshot.version !== DIALOG_SNAPSHOT_VERSION || !Array.isArray(snapshot.dialogs)) {
    return emptyDialogSnapshot
  }

  return {
    version: DIALOG_SNAPSHOT_VERSION,
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : null,
    dialogs: snapshot.dialogs.map(sanitizeDialog),
  }
}

export const dialogSnapshot = derived(rawDialogSnapshot, ($rawDialogSnapshot) => normalizeDialogSnapshot($rawDialogSnapshot))
export const dialogSnapshotUpdatedAt = derived(dialogSnapshot, ($dialogSnapshot) => $dialogSnapshot.updatedAt)
export const hasDialogSnapshot = derived(dialogSnapshot, ($dialogSnapshot) => $dialogSnapshot.dialogs.length > 0)
export const dialogDataSource = writable<DialogDataSource>('empty')

export const galleries = derived([allDialogs, galleryIds], ([$allDialogs, $galleryIds]) => {
  const pinnedDialogs = $allDialogs.filter((dialog) => $galleryIds.includes(dialog.id))
  const galleryTypeDialogs = $allDialogs.filter((dialog) => dialog.kind === 'gallery')
  
  // Combine: gallery-type dialogs + pinned dialogs (excluding duplicates)
  const combined = [...galleryTypeDialogs]
  for (const dialog of pinnedDialogs) {
    if (!combined.some(d => d.id === dialog.id)) {
      combined.push(dialog)
    }
  }
  
  return combined
})

export function setDialogs(dialogs: Dialog[]): void {
  const sanitizedDialogs = dialogs.map(sanitizeDialog)

  allDialogs.set(sanitizedDialogs)
  dialogDataSource.set(sanitizedDialogs.length > 0 ? 'live' : 'empty')
  rawDialogSnapshot.set({
    version: DIALOG_SNAPSHOT_VERSION,
    updatedAt: Date.now(),
    dialogs: sanitizedDialogs,
  })
}

export function hydrateDialogsFromSnapshot(): boolean {
  const snapshot = get(dialogSnapshot)

  allDialogs.set(snapshot.dialogs)
  dialogDataSource.set(snapshot.dialogs.length > 0 ? 'snapshot' : 'empty')
  return snapshot.dialogs.length > 0
}

export function resetDialogsState(): void {
  allDialogs.set([])
  dialogSearch.set('')
  dialogDataSource.set('empty')
}

export function clearDialogSnapshot(): void {
  rawDialogSnapshot.set(emptyDialogSnapshot)
}

export function toggleGallery(dialogId: string): void {
  galleryIds.update((current) =>
    current.includes(dialogId) ? current.filter((id) => id !== dialogId) : [...current, dialogId],
  )
}
