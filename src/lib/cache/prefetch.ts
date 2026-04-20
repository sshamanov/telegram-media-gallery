import { getPrefetch, upsertPrefetch, getAllPrefetches, removePrefetch, type PrefetchQueueItem } from './indexeddb'

// Re-export for convenience
export { getAllPrefetches, type PrefetchQueueItem }
import { debugLog } from '../debug'
import { readOpfsBlob, writeFullMediaBlob } from './opfs'
import { getTelegramAdapter } from '../telegram/adapter'
import { batchIndexMediaItems } from '../search/offline'
import { classifyMediaType } from '../media'
import type { Message } from '../../types/telegram'

function cloneBufferToBlob(buffer: Uint8Array, type: string): Blob {
  return new Blob([buffer as BlobPart], { type })
}

const MAX_CONCURRENT_DOWNLOADS = 2
const PREFETCH_WORKER_INTERVAL = 5000 // Check every 5 seconds
const PAGE_SIZE = 100 // Same as gallery store

let workerInterval: number | null = null
let activeDownloads = new Map<string, AbortController>()

function classifyMessage(message: Message) {
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



export async function markDialogForOffline(dialogId: string): Promise<void> {
  const existing = await getPrefetch(dialogId)
  if (existing && (existing.status === 'downloading' || existing.status === 'pending')) {
    debugLog('prefetch', `Dialog ${dialogId} already marked for offline`)
    return
  }

  const item: PrefetchQueueItem = {
    dialogId,
    status: 'pending',
    totalItems: 0,
    processedItems: 0,
    startedAt: Date.now(),
    completedAt: null,
    error: null
  }

  await upsertPrefetch(item)
  debugLog('prefetch', `Marked dialog ${dialogId} for offline`)
  
  // Start worker if not already running
  if (!workerInterval) {
    startPrefetchWorker()
  }
}

export async function startPrefetchWorker(): Promise<void> {
  if (workerInterval) {
    debugLog('prefetch', 'Prefetch worker already running')
    return
  }

  debugLog('prefetch', 'Starting prefetch worker')
  
  workerInterval = window.setInterval(async () => {
    try {
      await processPrefetchQueue()
    } catch (error) {
      debugLog('prefetch', `Error in prefetch worker: ${error}`)
    }
  }, PREFETCH_WORKER_INTERVAL)
}

export async function stopPrefetchWorker(): Promise<void> {
  if (workerInterval) {
    window.clearInterval(workerInterval)
    workerInterval = null
    debugLog('prefetch', 'Stopped prefetch worker')
  }
  
  // Cancel all active downloads
  for (const controller of activeDownloads.values()) {
    controller.abort()
  }
  activeDownloads.clear()
}

export async function getPrefetchStatus(dialogId: string): Promise<PrefetchQueueItem | null> {
  return await getPrefetch(dialogId)
}

export async function cancelPrefetch(dialogId: string): Promise<void> {
  const controller = activeDownloads.get(dialogId)
  if (controller) {
    controller.abort()
    activeDownloads.delete(dialogId)
  }
  
  await removePrefetch(dialogId)
  debugLog('prefetch', `Cancelled prefetch for dialog ${dialogId}`)
  
  // Stop worker if no more prefetches
  const allPrefetches = await getAllPrefetches()
  const hasActive = allPrefetches.some(p => p.status === 'pending' || p.status === 'downloading')
  if (!hasActive && workerInterval) {
    stopPrefetchWorker()
  }
}

async function processPrefetchQueue(): Promise<void> {
  // Check if online
  if (!navigator.onLine) {
    debugLog('prefetch', 'Skipping prefetch processing - offline')
    return
  }

  const allPrefetches = await getAllPrefetches()
  const pending = allPrefetches.filter(p => p.status === 'pending')
  const downloading = allPrefetches.filter(p => p.status === 'downloading')
  
  // Start new downloads if we have capacity
  const availableSlots = MAX_CONCURRENT_DOWNLOADS - downloading.length
  if (availableSlots > 0 && pending.length > 0) {
    const toStart = pending.slice(0, availableSlots)
    for (const prefetch of toStart) {
      startDialogPrefetch(prefetch)
    }
  }
}

async function startDialogPrefetch(prefetch: PrefetchQueueItem): Promise<void> {
  const { dialogId } = prefetch
  
  // Update status to downloading
  const updated: PrefetchQueueItem = {
    ...prefetch,
    status: 'downloading',
    startedAt: Date.now()
  }
  await upsertPrefetch(updated)
  
  // Create abort controller for this download
  const controller = new AbortController()
  activeDownloads.set(dialogId, controller)
  
  try {
    debugLog('prefetch', `Starting prefetch for dialog ${dialogId}`)
    
    // Get adapter
    const adapter = getTelegramAdapter()
    
    // Fetch all media messages
    let offset: { id: number; date: number } | null = null
    let hasMore = true
    let allMediaItems: Array<ReturnType<typeof classifyMessage>> = []
    
    while (hasMore && !controller.signal.aborted) {
      const page = await adapter.getMessages(dialogId, {
        limit: PAGE_SIZE,
        offset
      })
      
      // Classify messages to get media items
      const mediaItems = page.messages
        .map(classifyMessage)
        .filter((item): item is NonNullable<ReturnType<typeof classifyMessage>> => item !== null)
      
      allMediaItems.push(...mediaItems)
      
      offset = page.nextOffset
      hasMore = offset !== null
      
      debugLog('prefetch', `Fetched ${mediaItems.length} media items from dialog ${dialogId}, hasMore: ${hasMore}`)
    }
    
    if (controller.signal.aborted) {
      throw new Error('Prefetch cancelled')
    }
    
    const totalItems = allMediaItems.length
    
    // Update total items
    updated.totalItems = totalItems
    await upsertPrefetch(updated)
    
    debugLog('prefetch', `Dialog ${dialogId} has ${totalItems} media items to prefetch`)
    
    // Index all media items for offline search
    try {
      // Filter out null items and cast to MediaItem[]
      const mediaItems = allMediaItems.filter((item): item is NonNullable<typeof item> => item !== null)
      await batchIndexMediaItems(mediaItems)
      debugLog('prefetch', `Indexed ${mediaItems.length} media items for offline search`)
    } catch (error) {
      debugLog('prefetch', `Failed to index media items for search: ${error}`)
    }
    
    // Download each media item
    for (let i = 0; i < totalItems; i++) {
      if (controller.signal.aborted) {
        debugLog('prefetch', `Prefetch for dialog ${dialogId} was cancelled`)
        throw new Error('Prefetch cancelled')
      }
      
      const mediaItem = allMediaItems[i]
      if (!mediaItem) continue
      
      try {
        // Check if already cached (using OPFS)
        const cacheKey = `${mediaItem.dialogId}:${mediaItem.messageId}`
        const existing = await readOpfsBlob(mediaItem.dialogId, mediaItem.messageId, mediaItem.mimeType)
        if (existing) {
          debugLog('prefetch', `Media ${cacheKey} already cached, skipping`)
          updated.processedItems = i + 1
          await upsertPrefetch(updated)
          continue
        }
        
        // Download full media
        debugLog('prefetch', `Downloading media ${cacheKey} (${i + 1}/${totalItems})`)
        const bytes = await adapter.downloadFull(mediaItem.media, undefined, controller.signal)
        const blob = cloneBufferToBlob(bytes, mediaItem.mimeType)
        
        // Cache in OPFS
        await writeFullMediaBlob(
          cacheKey,
          mediaItem.dialogId,
          mediaItem.messageId,
          mediaItem.mimeType,
          blob
        )
        
        // Update progress
        updated.processedItems = i + 1
        await upsertPrefetch(updated)
        
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error // Re-throw abort to stop the whole prefetch
        }
        debugLog('prefetch', `Failed to download media ${mediaItem.id}: ${error}`)
        // Continue with next item despite error
      }
    }
    
    // Mark as completed
    updated.status = 'completed'
    updated.completedAt = Date.now()
    updated.error = null
    await upsertPrefetch(updated)
    
    debugLog('prefetch', `Completed prefetch for dialog ${dialogId}`)
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      debugLog('prefetch', `Prefetch for dialog ${dialogId} was cancelled`)
      await removePrefetch(dialogId)
    } else {
      debugLog('prefetch', `Prefetch for dialog ${dialogId} failed: ${error}`)
      
      // Update status to failed
      const failed: PrefetchQueueItem = {
        ...prefetch,
        status: 'failed',
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      }
      await upsertPrefetch(failed)
    }
  } finally {
    activeDownloads.delete(dialogId)
    
    // Check if we should stop the worker
    const allPrefetches = await getAllPrefetches()
    const hasActive = allPrefetches.some(p => p.status === 'pending' || p.status === 'downloading')
    if (!hasActive && workerInterval) {
      stopPrefetchWorker()
    }
  }
}

// Initialize worker on module load if there are pending prefetches
;(async () => {
  try {
    const allPrefetches = await getAllPrefetches()
    const hasActive = allPrefetches.some(p => p.status === 'pending' || p.status === 'downloading')
    if (hasActive) {
      startPrefetchWorker()
    }
  } catch (error) {
    debugLog('prefetch', `Failed to initialize prefetch worker: ${error}`)
  }
})()