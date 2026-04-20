import { get, writable, derived } from 'svelte/store'
import { debugLog, DEBUG_VIEWER } from '../lib/debug'
import { classifyMediaType, isImageItem, matchesFilter, matchesAuthorFilter, mediaTypeToFilter } from '../lib/media'
import { getTelegramAdapter, type MessagePage } from '../lib/telegram/adapter'
import { blobToFile, getCachedBlob, getCachedOrDownloadBlob, parseFloodWaitSeconds, sleep } from '../lib/files'
import { getSizeLimitForMediaType } from '../lib/telegram/constants'
import { navigateToViewer, getRouter } from '../lib/routing'
import { isOffline, pushToast } from './ui'
import { searchOfflineMedia } from '../lib/search/offline'
import type { Dialog, GalleryViewMode, GalleryFilterId, MediaItem, Message, UploadMode, UploadQueueItem, UploadQueueState, UploadState, DownloadQueueState, DownloadQueueItem, ForwardQueueState, ForwardQueueItem, ShareQueueState, ShareQueueItem, CopyQueueState, CopyQueueItem } from '../types/telegram'
import { persisted } from './persisted'
import { settings } from './settings'

const PAGE_SIZE = 100

// Map of active download abort controllers for parallel downloads
const activeDownloadControllers = new Map<string, AbortController>()

function detectUploadMediaType(file: File, mode: UploadMode): { mediaType: 'photo' | 'video' | 'audio' | 'document', fallback: boolean } {
  if (mode === 'file') {
    return { mediaType: 'document', fallback: false }
  }

  let detected: 'photo' | 'video' | 'audio' | 'document' = 'document'

  if (file.type.startsWith('image/')) {
    detected = 'photo'
  } else if (file.type.startsWith('video/')) {
    detected = 'video'
  } else if (file.type.startsWith('audio/')) {
    detected = 'audio'
  }

  let fallback = false
  if (detected !== 'document') {
    const limit = getSizeLimitForMediaType(detected)
    if (file.size > limit) {
      detected = 'document'
      fallback = true
    }
  }

  return { mediaType: detected, fallback }
}

export const currentDialog = writable<Dialog | null>(null)
export const mediaItems = writable<MediaItem[]>([])
export const viewerItems = writable<MediaItem[]>([])
export const viewerIndex = writable<number | null>(null)
export const loadState = writable<'idle' | 'loading' | 'error'>('idle')
export const isLoadingMore = writable(false)
export const gallerySearch = writable('')
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

export const downloadQueueState = writable<DownloadQueueState>({
  active: false,
  currentIndex: -1,
  items: [],
  totalItems: 0,
  completedItems: 0,
  directoryHandle: null,
})

export const forwardQueueState = writable<ForwardQueueState>({
  active: false,
  currentIndex: -1,
  items: [],
  totalItems: 0,
  completedItems: 0,
})

export const shareQueueState = writable<ShareQueueState>({
  active: false,
  currentIndex: -1,
  items: [],
  totalItems: 0,
  completedItems: 0,
})

export const copyQueueState = writable<CopyQueueState>({
  active: false,
  currentIndex: -1,
  items: [],
  totalItems: 0,
  completedItems: 0,
})

export const selectionMode = writable(false)
export const selectedMediaIds = writable<Set<string>>(new Set())
export const selectionAnchorId = writable<string | null>(null)
export const selectedFilter = writable<GalleryFilterId>('all')
export const selectedAuthors = writable<string[]>([])
export const authors = derived(mediaItems, ($mediaItems) => {
  const senders = new Set<string>()
  for (const item of $mediaItems) {
    if (item.sender) senders.add(item.sender)
  }
  return Array.from(senders).sort()
})

export const filteredMediaItems = derived(
  [mediaItems, selectedFilter, selectedAuthors, settings],
  ([$mediaItems, $selectedFilter, $selectedAuthors, $settings]) => {
    const hidden = $settings.defaultHiddenFilters ?? []
    return $mediaItems.filter(item => {
      // media type filter
      if ($selectedFilter !== 'all' && !matchesFilter(item, $selectedFilter)) return false
      // hidden filters (when selectedFilter is 'all')
      if ($selectedFilter === 'all' && hidden.includes(mediaTypeToFilter(item.type))) return false
      // author filter
      if (!matchesAuthorFilter(item, $selectedAuthors)) return false
      return true
    })
  }
)

export const searchedMediaItems = derived(
  [filteredMediaItems, gallerySearch, currentDialog, isOffline],
  ([$filteredMediaItems, $gallerySearch, $currentDialog, $isOffline], set) => {
    if (!$gallerySearch.trim()) {
      set($filteredMediaItems)
      return
    }
    
    const query = $gallerySearch.trim()
    
    // If offline, use offline search index
    if ($isOffline && $currentDialog) {
      searchOfflineMedia(query, $currentDialog.id)
        .then(searchResults => {
          // Convert search index results back to media items
          const searchResultIds = new Set(searchResults.map(r => r.mediaId))
          const filtered = $filteredMediaItems.filter(item => searchResultIds.has(item.id))
          set(filtered)
        })
        .catch(error => {
          console.warn('Offline search failed, falling back to client-side search:', error)
          // Fall back to client-side search
          performClientSideSearch($filteredMediaItems, query, set)
        })
    } else {
      // Online or no dialog: use client-side search
      performClientSideSearch($filteredMediaItems, query, set)
    }
  }
)

function performClientSideSearch(items: MediaItem[], query: string, set: (value: MediaItem[]) => void) {
  const normalizedQuery = query.toLowerCase().trim()
  const filtered = items.filter(item => {
    const filenameMatch = item.filename.toLowerCase().includes(normalizedQuery)
    const senderMatch = item.sender?.toLowerCase().includes(normalizedQuery) ?? false
    const captionMatch = item.caption?.toLowerCase().includes(normalizedQuery) ?? false
    return filenameMatch || senderMatch || captionMatch
  })
  
  set(filtered)
}

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
  selectionMode.set(false)
  selectedMediaIds.set(new Set())
  selectionAnchorId.set(null)
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

export function openViewer(items: MediaItem[], index: number, options?: { updateUrl?: boolean }): void {
  const { updateUrl = true } = options ?? {}

  if (DEBUG_VIEWER) {
    debugLog('gallery:openViewer', {
      index,
      itemCount: items.length,
      updateUrl,
      item: items[index] ?? null,
    })
  }
  
  viewerItems.set(items)
  viewerIndex.set(index)
  
  if (updateUrl && items.length > 0 && index >= 0 && index < items.length) {
    const item = items[index]
    navigateToViewer(item.dialogId, item.messageId)
  }
}

export function closeViewer(options?: { updateUrl?: boolean }): void {
  const { updateUrl = true } = options ?? {}

  if (DEBUG_VIEWER) {
    debugLog('gallery:closeViewer', {
      updateUrl,
      currentViewerIndex: get(viewerIndex),
      currentRoute: getRouter().getCurrentRoute(),
    })
  }
  
  viewerItems.set([])
  viewerIndex.set(null)
  
  if (updateUrl) {
    // Navigate back to previous route (should be gallery)
    getRouter().back()
  }
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
      // Detect if file size exceeds media-type limit and would fall back to document
      const { fallback } = detectUploadMediaType(item.file, mode)
      if (fallback) {
        pushToast({
          kind: 'warning',
          text: `File too large for media upload; sending as document.`,
          dismissible: true,
        })
      }

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
      const floodWaitSeconds = parseFloodWaitSeconds(error)
      
      if (floodWaitSeconds && !isCancelled) {
        // Pause the queue for FLOOD_WAIT
        updateQueueItem(item.id, (current) => ({
          ...current,
          status: 'paused',
          error: `Rate limited: wait ${floodWaitSeconds} seconds`,
        }))
        setLegacyUploadState({
          ...item,
          status: 'paused',
          error: `Rate limited: wait ${floodWaitSeconds} seconds`,
        }, mode, false)
        
        // Pause the entire queue
        uploadQueueState.update((current) => ({ ...current, active: false, currentIndex: -1 }))
        
        // Wait for the flood wait period
        await sleep(floodWaitSeconds * 1000)
        
        // Resume the queue
        await uploadQueueItems(dialogId, mode, itemIds)
        return
      } else {
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
      }
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

export function enterSelectionMode(itemId?: string): void {
  selectionMode.set(true)
  if (itemId) {
    selectedMediaIds.set(new Set([itemId]))
    selectionAnchorId.set(itemId)
  } else {
    selectedMediaIds.set(new Set())
    selectionAnchorId.set(null)
  }
}

export function exitSelectionMode(): void {
  selectionMode.set(false)
  selectedMediaIds.set(new Set())
  selectionAnchorId.set(null)
}

export function toggleSelectedMedia(itemId: string): void {
  selectedMediaIds.update((current) => {
    const next = new Set(current)
    if (next.has(itemId)) {
      next.delete(itemId)
    } else {
      next.add(itemId)
    }
    return next
  })
  selectionAnchorId.set(itemId)
}

export function selectOnlyMedia(itemId: string): void {
  selectedMediaIds.set(new Set([itemId]))
  selectionAnchorId.set(itemId)
}

export function selectMediaRange(itemIds: string[], startId: string, endId: string): void {
  const startIndex = itemIds.indexOf(startId)
  const endIndex = itemIds.indexOf(endId)
  if (startIndex === -1 || endIndex === -1) {
    return
  }

  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
  const rangeIds = itemIds.slice(from, to + 1)
  
  selectedMediaIds.update((current) => {
    const next = new Set(current)
    rangeIds.forEach((id) => next.add(id))
    return next
  })
  selectionAnchorId.set(endId)
}

export function selectAllVisibleMedia(itemIds: string[]): void {
  selectedMediaIds.set(new Set(itemIds))
  if (itemIds.length > 0) {
    selectionAnchorId.set(itemIds[0])
  }
}

export function isMediaSelected(itemId: string): boolean {
  return get(selectedMediaIds).has(itemId)
}

function updateDownloadQueueItem(itemId: string, updater: (item: DownloadQueueItem) => DownloadQueueItem): void {
  downloadQueueState.update((current) => ({
    ...current,
    items: current.items.map((item) => item.id === itemId ? updater(item) : item),
  }))
}

async function processDownloadQueue(mediaItems: MediaItem[]): Promise<void> {
  const state = get(downloadQueueState)
  const directoryHandle = state.directoryHandle
  const concurrency = get(settings).downloadConcurrency || 2
  
  downloadQueueState.update((current) => ({ ...current, active: true }))

  // Create a pool of workers for parallel downloads
  const queue = [...state.items]
  let completedCount = 0

  // Process queue with limited concurrency
  const processNext = async (): Promise<void> => {
    while (activeDownloadControllers.size < concurrency && queue.length > 0) {
      const item = queue.shift()
      if (!item) break

      // Skip already processed items
      if (item.status === 'cancelled' || item.status === 'complete') {
        completedCount++
        downloadQueueState.update((current) => ({ 
          ...current, 
          completedItems: completedCount 
        }))
        continue
      }

      const mediaItem = mediaItems.find((m) => m.id === item.mediaItemId)
      if (!mediaItem) {
        updateDownloadQueueItem(item.id, (current) => ({
          ...current,
          status: 'error',
          error: 'Media item not found',
        }))
        completedCount++
        downloadQueueState.update((current) => ({ 
          ...current, 
          completedItems: completedCount 
        }))
        continue
      }

      updateDownloadQueueItem(item.id, (current) => ({ 
        ...current, 
        status: 'downloading', 
        progress: 0, 
        error: null 
      }))

      const controller = new AbortController()
      activeDownloadControllers.set(item.id, controller)

      // Start download in background
      void downloadItem(item, mediaItem, controller).then(() => {
        activeDownloadControllers.delete(item.id)
        completedCount++
        downloadQueueState.update((current) => ({ 
          ...current, 
          completedItems: completedCount 
        }))
        // Process next item
        void processNext()
      })
    }

    // Check if all downloads are complete
    if (activeDownloadControllers.size === 0 && queue.length === 0) {
      downloadQueueState.update((current) => ({ 
        ...current, 
        active: false, 
        currentIndex: -1 
      }))
    }
  }

  // Download a single item
  async function downloadItem(
    item: DownloadQueueItem, 
    mediaItem: MediaItem, 
    controller: AbortController
  ): Promise<void> {
    try {
      const { getCachedOrDownloadBlob, saveBlob } = await import('../lib/files')
      
      const blob = await getCachedOrDownloadBlob(mediaItem, 'full', {
        onProgress: (progress) => {
          updateDownloadQueueItem(item.id, (current) => ({ ...current, progress }))
        },
        abortSignal: controller.signal,
      })

      if (!blob) {
        throw new Error('Download failed: no blob returned')
      }

      await saveBlob(blob, item.fileName, directoryHandle ?? undefined)
      updateDownloadQueueItem(item.id, (current) => ({ 
        ...current, 
        progress: 100, 
        status: 'complete', 
        error: null 
      }))
    } catch (error) {
      const isCancelled = controller.signal.aborted
      updateDownloadQueueItem(item.id, (current) => ({
        ...current,
        progress: isCancelled ? current.progress : 0,
        status: isCancelled ? 'cancelled' : 'error',
        error: isCancelled ? 'Download cancelled' : error instanceof Error ? error.message : 'Download failed',
      }))
    }
  }

  // Start initial batch of downloads
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    void processNext()
  }
}

export async function enqueueDownloads(mediaItems: MediaItem[], directoryHandle?: FileSystemDirectoryHandle | null): Promise<void> {
  if (mediaItems.length === 0) {
    return
  }

  if (get(isOffline)) {
    pushToast({ kind: 'warning', text: 'Downloads are unavailable offline unless the file is already open in the viewer cache.', dismissible: true })
    return
  }

  const items: DownloadQueueItem[] = mediaItems.map((item) => ({
    id: crypto.randomUUID(),
    mediaItemId: item.id,
    fileName: item.filename,
    progress: 0,
    status: 'queued',
    error: null,
  }))

  downloadQueueState.set({
    active: true,
    currentIndex: 0,
    items,
    totalItems: items.length,
    completedItems: 0,
    directoryHandle: directoryHandle ?? null,
  })

  await processDownloadQueue(mediaItems)
}

export function cancelDownloads(): void {
  // Abort all active downloads
  for (const [, controller] of activeDownloadControllers) {
    controller.abort()
  }
  activeDownloadControllers.clear()
  
  downloadQueueState.update((current) => ({
    ...current,
    active: false,
    currentIndex: -1,
    items: current.items.map((item) =>
      item.status === 'complete'
        ? item
        : {
            ...item,
            status: item.status === 'downloading' ? 'cancelled' : item.status,
            error: item.status === 'downloading' ? 'Download cancelled' : item.error,
          }),
  }))
}

function updateForwardQueueItem(itemId: string, updater: (item: ForwardQueueItem) => ForwardQueueItem): void {
  forwardQueueState.update((current) => ({
    ...current,
    items: current.items.map((item) => item.id === itemId ? updater(item) : item),
  }))
}

async function processForwardQueue(): Promise<void> {
  for (let index = 0; index < get(forwardQueueState).items.length; index += 1) {
    const snapshot = get(forwardQueueState)
    const item = snapshot.items[index]

    if (!item || item.status === 'cancelled' || item.status === 'complete') {
      continue
    }

    forwardQueueState.update((current) => ({ ...current, active: true, currentIndex: index }))
    updateForwardQueueItem(item.id, (current) => ({ ...current, status: 'forwarding', progress: 0, error: null }))

    const controller = new AbortController()

    try {
      await getTelegramAdapter().forwardMessages(item.targetDialogId, item.sourceDialogId, [item.sourceMessageId])

      updateForwardQueueItem(item.id, (current) => ({ ...current, progress: 100, status: 'complete', error: null }))
      forwardQueueState.update((current) => ({ ...current, completedItems: current.completedItems + 1 }))
    } catch (error) {
      const isCancelled = controller.signal.aborted
      updateForwardQueueItem(item.id, (current) => ({
        ...current,
        progress: isCancelled ? current.progress : 0,
        status: isCancelled ? 'cancelled' : 'error',
        error: isCancelled ? 'Forward cancelled' : error instanceof Error ? error.message : 'Forward failed',
      }))
    }
  }

  forwardQueueState.update((current) => ({ ...current, active: false, currentIndex: -1 }))
}

export async function enqueueForwards(mediaItems: MediaItem[], targetDialogId: string): Promise<void> {
  if (mediaItems.length === 0) {
    return
  }

  if (get(isOffline)) {
    pushToast({ kind: 'warning', text: 'Forwarding is unavailable offline until Telegram connectivity returns.', dismissible: true })
    return
  }

  const items: ForwardQueueItem[] = mediaItems.map((item) => ({
    id: crypto.randomUUID(),
    mediaItemId: item.id,
    fileName: item.filename,
    sourceDialogId: item.dialogId,
    sourceMessageId: item.messageId,
    targetDialogId,
    progress: 0,
    status: 'queued',
    error: null,
  }))

  forwardQueueState.set({
    active: true,
    currentIndex: 0,
    items,
    totalItems: items.length,
    completedItems: 0,
  })

  await processForwardQueue()
}

export function cancelForwards(): void {
  forwardQueueState.update((current) => ({
    ...current,
    active: false,
    currentIndex: -1,
    items: current.items.map((item, index) =>
      item.status === 'complete'
        ? item
        : {
            ...item,
            status: index >= current.currentIndex ? 'cancelled' : item.status,
            error: index >= current.currentIndex ? 'Forward cancelled' : item.error,
          }),
  }))
}

function updateShareQueueItem(itemId: string, updater: (item: ShareQueueItem) => ShareQueueItem): void {
  shareQueueState.update((current) => ({
    ...current,
    items: current.items.map((item) => item.id === itemId ? updater(item) : item),
  }))
}

async function processShareQueue(mediaItems: MediaItem[]): Promise<void> {
  const shareLimitBytes = 200 * 1024 * 1024

  for (let index = 0; index < get(shareQueueState).items.length; index += 1) {
    const snapshot = get(shareQueueState)
    const item = snapshot.items[index]

    if (!item || item.status === 'cancelled' || item.status === 'complete') {
      continue
    }

    shareQueueState.update((current) => ({ ...current, active: true, currentIndex: index }))
    updateShareQueueItem(item.id, (current) => ({ ...current, status: 'sharing', progress: 0, error: null }))

    const controller = new AbortController()
    const mediaItem = mediaItems.find(mi => mi.id === item.mediaItemId)

    if (!mediaItem) {
      updateShareQueueItem(item.id, (current) => ({
        ...current,
        status: 'error',
        error: 'Media item not found',
      }))
      continue
    }

    try {
      if (mediaItem.size > shareLimitBytes) {
        throw new Error(`File too large for sharing (${Math.round(mediaItem.size / 1024 / 1024)}MB > 200MB limit)`)
      }

      if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
        throw new Error('Web Share API not supported')
      }

      const blob = await getCachedOrDownloadBlob(mediaItem, 'full', {
        onProgress: (progress) => {
          updateShareQueueItem(item.id, (current) => ({ ...current, progress }))
        },
        abortSignal: controller.signal,
      })

      if (!blob) {
        throw new Error('Failed to download media')
      }

      const file = blobToFile(blob, mediaItem.filename)

      if (!navigator.canShare({ files: [file] })) {
        throw new Error('Cannot share this file type')
      }

       await navigator.share({ files: [file], title: mediaItem.filename })

      updateShareQueueItem(item.id, (current) => ({ ...current, progress: 100, status: 'complete', error: null }))
      shareQueueState.update((current) => ({ ...current, completedItems: current.completedItems + 1 }))
      
      // Show success toast for individual share
      pushToast({
        kind: 'success',
        text: `Shared "${mediaItem.filename}"`,
        dismissible: true,
      })
     } catch (error) {
      const isCancelled = controller.signal.aborted
      const errorMessage = isCancelled ? 'Share cancelled' : error instanceof Error ? error.message : 'Share failed'
      
      updateShareQueueItem(item.id, (current) => ({
        ...current,
        progress: isCancelled ? current.progress : 0,
        status: isCancelled ? 'cancelled' : 'error',
        error: errorMessage,
      }))
      
      // Show error toast for failed share (unless cancelled by user)
      if (!isCancelled) {
        pushToast({
          kind: 'error',
          text: `Failed to share "${mediaItem.filename}": ${errorMessage}`,
          dismissible: true,
        })
      }
    }
  }

  shareQueueState.update((current) => ({ ...current, active: false, currentIndex: -1 }))
}

export async function enqueueShares(mediaItems: MediaItem[]): Promise<void> {
  if (mediaItems.length === 0) {
    return
  }

  if (get(isOffline)) {
    pushToast({ kind: 'warning', text: 'Sharing is unavailable offline because uncached media cannot be fetched.', dismissible: true })
    return
  }

  const items: ShareQueueItem[] = mediaItems.map((item) => ({
    id: crypto.randomUUID(),
    mediaItemId: item.id,
    fileName: item.filename,
    progress: 0,
    status: 'queued',
    error: null,
  }))

  shareQueueState.set({
    active: true,
    currentIndex: 0,
    items,
    totalItems: items.length,
    completedItems: 0,
  })

  await processShareQueue(mediaItems)
}

export function cancelShares(): void {
  shareQueueState.update((current) => ({
    ...current,
    active: false,
    currentIndex: -1,
    items: current.items.map((item, index) =>
      item.status === 'complete'
        ? item
        : {
            ...item,
            status: index >= current.currentIndex ? 'cancelled' : item.status,
            error: index >= current.currentIndex ? 'Share cancelled' : item.error,
          }),
  }))
}

function updateCopyQueueItem(itemId: string, updater: (item: CopyQueueItem) => CopyQueueItem): void {
  copyQueueState.update((current) => ({
    ...current,
    items: current.items.map((item) => item.id === itemId ? updater(item) : item),
  }))
}

async function processCopyQueue(mediaItems: MediaItem[]): Promise<void> {
  for (let index = 0; index < get(copyQueueState).items.length; index += 1) {
    const snapshot = get(copyQueueState)
    const item = snapshot.items[index]

    if (!item || item.status === 'cancelled' || item.status === 'complete') {
      continue
    }

    copyQueueState.update((current) => ({ ...current, active: true, currentIndex: index }))
    updateCopyQueueItem(item.id, (current) => ({ ...current, status: 'copying', progress: 0, error: null }))

    const controller = new AbortController()
    const mediaItem = mediaItems.find(mi => mi.id === item.mediaItemId)

    if (!mediaItem) {
      updateCopyQueueItem(item.id, (current) => ({
        ...current,
        status: 'error',
        error: 'Media item not found',
      }))
      continue
    }

    try {
      if (!isImageItem(mediaItem)) {
        throw new Error('Only images can be copied to clipboard')
      }

      if (typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard API not supported')
      }

      const blob = await getCachedOrDownloadBlob(mediaItem, 'full', {
        onProgress: (progress) => {
          updateCopyQueueItem(item.id, (current) => ({ ...current, progress }))
        },
        abortSignal: controller.signal,
      })

      if (!blob) {
        throw new Error('Failed to download media')
      }

       await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob }),
      ])

      updateCopyQueueItem(item.id, (current) => ({ ...current, progress: 100, status: 'complete', error: null }))
      copyQueueState.update((current) => ({ ...current, completedItems: current.completedItems + 1 }))
      
      // Show success toast for individual copy
      pushToast({
        kind: 'success',
        text: `Copied "${mediaItem.filename}" to clipboard`,
        dismissible: true,
      })
     } catch (error) {
      const isCancelled = controller.signal.aborted
      const errorMessage = isCancelled ? 'Copy cancelled' : error instanceof Error ? error.message : 'Copy failed'
      
      updateCopyQueueItem(item.id, (current) => ({
        ...current,
        progress: isCancelled ? current.progress : 0,
        status: isCancelled ? 'cancelled' : 'error',
        error: errorMessage,
      }))
      
      // Show error toast for failed copy (unless cancelled by user)
      if (!isCancelled) {
        pushToast({
          kind: 'error',
          text: `Failed to copy "${mediaItem.filename}": ${errorMessage}`,
          dismissible: true,
        })
      }
    }
  }

  copyQueueState.update((current) => ({ ...current, active: false, currentIndex: -1 }))
}

export async function enqueueCopies(mediaItems: MediaItem[]): Promise<void> {
  if (mediaItems.length === 0) {
    return
  }

  const items: CopyQueueItem[] = mediaItems.map((item) => ({
    id: crypto.randomUUID(),
    mediaItemId: item.id,
    fileName: item.filename,
    progress: 0,
    status: 'queued',
    error: null,
  }))

  copyQueueState.set({
    active: true,
    currentIndex: 0,
    items,
    totalItems: items.length,
    completedItems: 0,
  })

  await processCopyQueue(mediaItems)
}

export function cancelCopies(): void {
  copyQueueState.update((current) => ({
    ...current,
    active: false,
    currentIndex: -1,
    items: current.items.map((item, index) =>
      item.status === 'complete'
        ? item
        : {
            ...item,
            status: index >= current.currentIndex ? 'cancelled' : item.status,
            error: index >= current.currentIndex ? 'Copy cancelled' : item.error,
          }),
  }))
}

export async function canDownloadMediaSelectionOffline(mediaItems: MediaItem[]): Promise<boolean> {
  if (mediaItems.length === 0) {
    return false
  }

  const cached = await Promise.all(mediaItems.map((item) => getCachedBlob(item, 'full')))
  return cached.every((blob) => blob !== null)
}
