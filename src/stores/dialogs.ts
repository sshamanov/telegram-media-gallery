import { derived } from 'svelte/store'
import type { Dialog } from '../types/telegram'
import { persisted } from './persisted'
import { writable } from 'svelte/store'

export const allDialogs = writable<Dialog[]>([])
export const galleryIds = persisted<string[]>('galleryIds', [])
export const dialogSearch = writable('')

export const galleries = derived([allDialogs, galleryIds], ([$allDialogs, $galleryIds]) =>
  $allDialogs.filter((dialog) => $galleryIds.includes(dialog.id)),
)

export function setDialogs(dialogs: Dialog[]): void {
  allDialogs.set(dialogs)
}

export function toggleGallery(dialogId: string): void {
  galleryIds.update((current) =>
    current.includes(dialogId) ? current.filter((id) => id !== dialogId) : [...current, dialogId],
  )
}
