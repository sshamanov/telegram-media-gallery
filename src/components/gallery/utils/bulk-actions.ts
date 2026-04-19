import type { MediaItem } from '../../../types/telegram'
import type { ToastMessage } from '../../../types/telegram'

export async function refreshOfflineSelectionState(
  items: MediaItem[],
  offline: boolean,
  canDownloadMediaSelectionOffline: (items: MediaItem[]) => Promise<boolean>
): Promise<boolean> {
  if (!offline) {
    return false
  }

  return await canDownloadMediaSelectionOffline(items)
}

export interface BulkDownloadOptions {
  selectedCount: number
  selectedItems: MediaItem[]
  isOffline: boolean
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void
  enqueueDownloads: (items: MediaItem[], directoryHandle: FileSystemDirectoryHandle | null) => Promise<void>
}

export async function handleBulkDownload(options: BulkDownloadOptions): Promise<void> {
  const { selectedCount, selectedItems, isOffline, pushToast, enqueueDownloads } = options
  
  if (selectedCount === 0) {
    return
  }

  if (isOffline) {
    pushToast({
      kind: 'warning',
      text: 'Downloads are unavailable offline unless the file is already open in the viewer cache.',
      dismissible: true,
    })
    return
  }

  let directoryHandle: FileSystemDirectoryHandle | null = null

  // Try to use File System Access API on desktop
  if ('showDirectoryPicker' in window && window.showDirectoryPicker) {
    try {
      directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads',
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('Failed to request directory, falling back to per-file downloads:', error)
      }
    }
  }

  await enqueueDownloads(selectedItems, directoryHandle)
}

export interface BulkForwardOptions {
  selectedCount: number
  isOffline: boolean
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void
  onShowDialogPicker: () => void
}

export function handleBulkForward(options: BulkForwardOptions): void {
  const { selectedCount, isOffline, pushToast, onShowDialogPicker } = options
  
  if (selectedCount === 0) {
    return
  }

  if (isOffline) {
    pushToast({
      kind: 'warning',
      text: 'Forwarding is unavailable offline until Telegram connectivity returns.',
      dismissible: true,
    })
    return
  }

  onShowDialogPicker()
}

export interface BulkShareOptions {
  selectedCount: number
  selectedItems: MediaItem[]
  isOffline: boolean
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void
  enqueueShares: (items: MediaItem[]) => Promise<void>
}

export async function handleBulkShare(options: BulkShareOptions): Promise<void> {
  const { selectedCount, selectedItems, isOffline, pushToast, enqueueShares } = options
  
  if (selectedCount === 0) {
    return
  }

  if (isOffline) {
    pushToast({
      kind: 'warning',
      text: 'Sharing is unavailable offline because uncached media cannot be fetched.',
      dismissible: true,
    })
    return
  }

  await enqueueShares(selectedItems)
}

export interface BulkCopyOptions {
  selectedCount: number
  visibleItems: MediaItem[]
  selectedMediaIds: Set<string>
  enqueueCopies: (items: MediaItem[]) => Promise<void>
}

export async function handleBulkCopy(options: BulkCopyOptions): Promise<void> {
  const { selectedCount, visibleItems, selectedMediaIds, enqueueCopies } = options
  
  if (selectedCount === 0) {
    return
  }

  const selectedItems = visibleItems.filter((item) => selectedMediaIds.has(item.id))
  await enqueueCopies(selectedItems)
}