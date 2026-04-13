import { derived } from 'svelte/store'
import type { Dialog } from '../types/telegram'
import { persisted } from './persisted'
import { writable } from 'svelte/store'

export const allDialogs = writable<Dialog[]>([])
export const galleryIds = persisted<string[]>('galleryIds', [])
export const dialogSearch = writable('')

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
  allDialogs.set(dialogs)
}

export function toggleGallery(dialogId: string): void {
  galleryIds.update((current) =>
    current.includes(dialogId) ? current.filter((id) => id !== dialogId) : [...current, dialogId],
  )
}
