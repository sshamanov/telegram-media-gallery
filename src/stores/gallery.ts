import { get, writable } from 'svelte/store'
import { debugLog } from '../lib/debug'
import { classifyMediaType } from '../lib/media'
import { getTelegramAdapter, type MessagePage } from '../lib/telegram/adapter'
import type { Dialog, GalleryViewMode, MediaItem, Message, UploadMode, UploadQueueItem, UploadQueueState, UploadState } from '../types/telegram'
import { persisted } from './persisted'

const PAGE_SIZE = 100

export const currentDialog = writable<Dialog | null>(null)
export const mediaItems = writable<MediaItem[]>([])
export const viewerItems = writable<MediaItem[]>([])
export const viewerIndex = writable<number | null>(null)
export const loadState = writable<'idle' | 'loading' | 'error'>('idle')
export const isLoadingMore = writable(false)
export const hasMoreMedia = writable(false)
export const currentLoadId = writable(0)
export const lastOffset = writable<{ id: number; date: number } | null>(null)
export const totalMessageCount = writable<number | null>(null)
export const scrollPositions = persisted<Record<string, number>>('scrollPositions', {})
export const galleryViewMode = writable<GalleryViewMode>('grid')
export const uploadMode = writable<UploadMode>('media')
export const uploadState = writable<UploadState>({
  active: false,
  fileName: null,
  progress: 0,
  error: null,
  mode: 'media',
})
export const uploadQueueState = writable<UploadQueueState>({
  active: false,
  mode: 'media',
  currentIndex: -1,
  items: [],
})

let loadedMessageIds = new Set<number>()
let activeUploadAbortController: AbortController | null = null

function classifyMessage(message: Message): MediaItem | null {
  if (!message.media) {
    return null
  }

  const mimeType = message.media.mimeType
    ?? (message.media.kind === 'photo'
      ? 'image/jpeg'
      : message.media.kind === 'video'
        ? 'video/mp4'
        : 'application/octet-stream')
  const extension = mimeType.split('/')[1] ?? 'bin'
  const filename = message.media.fileName?.trim() || `${message.media.kind}-${message.id}.${extension}`

  return {
    id: `${message.dialogId}:${message.id}`,
    dialogId: message.dialogId,
    messageId: message.id,
    filename,
    mimeType,
    type: classifyMediaType(message.media),
    width: message.media.width ?? (message.media.kind === 'photo' || message.media.kind === 'video' ? 1600 : 0),
    height: message.media.height ?? (message.media.kind === 'photo' || message.media.kind === 'video' ? 1200 : 0),
    size: message.media.size ?? 0,
    durationSeconds: message.media.durationSeconds ?? null,
    date: message.date,
    sender: message.sender,
    caption: message.text,
    media: message.media,
  }
}

function resetDialogState(dialog: Dialog | null): void {
  currentDialog.set(dialog)
  mediaItems.set([])
  viewerItems.set([])
  viewerIndex.set(null)
  loadState.set('idle')
  isLoadingMore.set(false)
  hasMoreMedia.set(Boolean(dialog))
  lastOffset.set(null)
  totalMessageCount.set(null)
  currentLoadId.update((value) => value + 1)
  loadedMessageIds = new Set<number>()
}

async function fetchPage(limit: number, offset?: { id: number; date: number } | null): Promise<MessagePage> {
  const dialog = get(currentDialog)
  if (!dialog) {
    return { messages: [], nextOffset: null, totalMessages: 0 }
  }

  return getTelegramAdapter().getMessages(dialog.id, {
    limit,
    offset,
  })
}

export async function loadInitialMedia(): Promise<void> {
  if (!get(currentDialog)) {
    return
  }

  mediaItems.set([])
  lastOffset.set(null)
  hasMoreMedia.set(true)
  loadedMessageIds = new Set<number>()
  loadState.set('loading')

  try {
    await loadMoreMedia(PAGE_SIZE)
    if (get(loadState) !== 'error') {
      loadState.set('idle')
    }
  } catch {
    loadState.set('error')
  }
}

export async function loadMoreMedia(limit = PAGE_SIZE): Promise<void> {
  const dialog = get(currentDialog)
  if (!dialog || get(isLoadingMore) || !get(hasMoreMedia)) {
    return
  }

  const loadId = get(currentLoadId)
  const offset = get(lastOffset)
  isLoadingMore.set(true)

  try {
    let cursor = offset
    let exhausted = false
    const appendedItems: MediaItem[] = []

    for (let attempt = 0; attempt < 10; attempt += 1) {
      debugLog('gallery:loadMore:attempt', {
        dialogId: dialog.id,
        attempt,
        cursor,
        loadedCount: get(mediaItems).length,
      })

      const page = await fetchPage(limit, cursor)
      if (get(currentLoadId) !== loadId) {
        return
      }

      const messages = page.messages

      // Record total message count from the first server response
      if (get(totalMessageCount) === null && page.totalMessages > 0) {
        totalMessageCount.set(page.totalMessages)
        debugLog('gallery:totalMessages', { count: page.totalMessages })
      }

      debugLog('gallery:loadMore:batch', {
        dialogId: dialog.id,
        attempt,
        messageCount: messages.length,
        firstId: messages[0]?.id ?? null,
        lastId: messages[messages.length - 1]?.id ?? null,
        nextOffset: page.nextOffset,
      })

      if (messages.length === 0) {
        exhausted = page.nextOffset === null
        if (!exhausted) {
          cursor = page.nextOffset
          lastOffset.set(cursor)
          continue
        }
        break
      }

      cursor = page.nextOffset
      lastOffset.set(cursor ?? null)

      const batchItems = messages
        .filter((message) => {
          if (loadedMessageIds.has(message.id)) {
            return false
          }

          loadedMessageIds.add(message.id)
          return true
        })
        .map((message) => classifyMessage(message))
        .filter((item): item is MediaItem => item !== null)

      debugLog('gallery:loadMore:media-batch', {
        dialogId: dialog.id,
        attempt,
        mediaCount: batchItems.length,
      })

      if (batchItems.length > 0) {
        appendedItems.push(...batchItems)
        if (page.nextOffset === null) {
          exhausted = true
        }
        break
      }

      if (page.nextOffset === null) {
        exhausted = true
        break
      }
    }

    if (appendedItems.length > 0) {
      mediaItems.update((current) => [...current, ...appendedItems])
    }

    if (exhausted) {
      hasMoreMedia.set(false)
    }

    loadState.set('idle')
  } catch {
    if (get(currentLoadId) === loadId) {
      loadState.set('error')
    }
  } finally {
    if (get(currentLoadId) === loadId) {
      isLoadingMore.set(false)
    }
  }
}

export function setActiveDialog(dialog: Dialog | null): void {
  resetDialogState(dialog)
}

export function openViewer(items: MediaItem[], index: number): void {
  viewerItems.set(items)
  viewerIndex.set(index)
}

export function closeViewer(): void {
  viewerItems.set([])
  viewerIndex.set(null)
}

export function setViewerIndex(index: number | null): void {
  viewerIndex.set(index)
}

export function storeScrollPosition(dialogId: string, value: number): void {
  scrollPositions.update((current) => ({ ...current, [dialogId]: value }))
}

export function setGalleryViewMode(mode: GalleryViewMode): void {
  galleryViewMode.set(mode)
}

export function setUploadMode(mode: UploadMode): void {
  uploadMode.set(mode)
}

function setLegacyUploadState(item: UploadQueueItem | null, mode: UploadMode, active: boolean): void {
  uploadState.set({
    active,
    fileName: item?.fileName ?? null,
    progress: item?.progress ?? (active ? 0 : 100),
    error: item?.error ?? null,
    mode,
  })
}

function updateQueueItem(itemId: string, updater: (item: UploadQueueItem) => UploadQueueItem): void {
  uploadQueueState.update((current) => ({
    ...current,
    items: current.items.map((item) => item.id === itemId ? updater(item) : item),
  }))
}

async function uploadQueueItems(dialogId: string, mode: UploadMode, itemIds?: string[]): Promise<void> {
  let shouldReload = false

  for (let index = 0; index < get(uploadQueueState).items.length; index += 1) {
    const snapshot = get(uploadQueueState)
    const item = snapshot.items[index]

    if (!item || item.status === 'cancelled' || item.status === 'complete') {
      continue
    }

    if (itemIds && !itemIds.includes(item.id)) {
      continue
    }

    uploadQueueState.update((current) => ({ ...current, active: true, currentIndex: index }))
    updateQueueItem(item.id, (current) => ({ ...current, status: 'uploading', progress: 0, error: null }))
    setLegacyUploadState({ ...item, status: 'uploading', progress: 0, error: null }, mode, true)

    const controller = new AbortController()
    activeUploadAbortController = controller

    try {
      await getTelegramAdapter().uploadAndSend(dialogId, item.file, mode, (progress) => {
        updateQueueItem(item.id, (current) => ({ ...current, progress }))
        const latest = get(uploadQueueState).items.find((entry) => entry.id === item.id) ?? null
        setLegacyUploadState(latest, mode, true)
      }, controller.signal)

      shouldReload = true
      updateQueueItem(item.id, (current) => ({ ...current, progress: 100, status: 'complete', error: null }))
      setLegacyUploadState({ ...item, status: 'complete', progress: 100, error: null }, mode, false)
    } catch (error) {
      const isCancelled = controller.signal.aborted
      updateQueueItem(item.id, (current) => ({
        ...current,
        progress: isCancelled ? current.progress : 0,
        status: isCancelled ? 'cancelled' : 'error',
        error: isCancelled ? 'Upload cancelled' : error instanceof Error ? error.message : 'Upload failed',
      }))
      setLegacyUploadState({
        ...item,
        progress: 0,
        status: isCancelled ? 'cancelled' : 'error',
        error: isCancelled ? 'Upload cancelled' : error instanceof Error ? error.message : 'Upload failed',
      }, mode, false)
    } finally {
      if (activeUploadAbortController === controller) {
        activeUploadAbortController = null
      }
    }
  }

  uploadQueueState.update((current) => ({ ...current, active: false, currentIndex: -1 }))

  if (shouldReload) {
    await loadInitialMedia()
  }
}

export async function enqueueUploadToCurrentDialog(files: File[], mode: UploadMode = get(uploadMode)): Promise<void> {
  const dialog = get(currentDialog)
  if (!dialog || files.length === 0) {
    return
  }

  const items: UploadQueueItem[] = files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    progress: 0,
    status: 'queued',
    error: null,
    mode,
  }))

  uploadQueueState.set({
    active: true,
    mode,
    currentIndex: 0,
    items,
  })

  await uploadQueueItems(dialog.id, mode)
}

export async function retryUploadQueueItem(itemId: string): Promise<void> {
  const dialog = get(currentDialog)
  const state = get(uploadQueueState)
  const item = state.items.find((entry) => entry.id === itemId)

  if (!dialog || !item) {
    return
  }

  updateQueueItem(itemId, (current) => ({ ...current, progress: 0, status: 'queued', error: null }))
  await uploadQueueItems(dialog.id, state.mode, [itemId])
}

export function cancelUploadQueue(): void {
  activeUploadAbortController?.abort()
  uploadQueueState.update((current) => ({
    ...current,
    active: false,
    currentIndex: -1,
    items: current.items.map((item, index) =>
      item.status === 'complete'
        ? item
        : {
            ...item,
            status: index >= current.currentIndex ? 'cancelled' : item.status,
            error: index >= current.currentIndex ? 'Upload cancelled' : item.error,
          }),
  }))
  setLegacyUploadState(null, get(uploadMode), false)
}

export function cancelUploadQueueItem(itemId: string): void {
  const state = get(uploadQueueState)
  const currentItem = state.items[state.currentIndex]
  if (currentItem?.id === itemId) {
    activeUploadAbortController?.abort()
  }

  updateQueueItem(itemId, (current) => ({
    ...current,
    status: current.status === 'complete' ? 'complete' : 'cancelled',
    error: current.status === 'complete' ? null : 'Upload cancelled',
  }))
}

export async function uploadToCurrentDialog(file: File, mode: UploadMode = get(uploadMode)): Promise<void> {
  await enqueueUploadToCurrentDialog([file], mode)
}
