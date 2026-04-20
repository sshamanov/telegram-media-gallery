import {
  enqueueUpload as dbEnqueueUpload,
  getPendingUploads as dbGetPendingUploads,
  removeUpload as dbRemoveUpload,
  updateUploadRetry as dbUpdateUploadRetry
} from '../cache/indexeddb'
import { debugLog, debugWarn } from '../debug'

const MAX_RETRY_COUNT = 3

export interface UploadQueueStats {
  pending: number
  retrying: number
  total: number
}

/**
 * Enqueue an upload for background sync.
 * Call this when the user initiates an upload while offline.
 */
export async function enqueueUpload(dialogId: string, file: File): Promise<void> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const uploadItem = {
      dialogId,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        data: arrayBuffer
      }
    }
    
    const id = await dbEnqueueUpload(uploadItem)
    debugLog('upload-queue: enqueued upload', { id, dialogId, fileName: file.name, size: file.size })
    
    // Register sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready
        // Type assertion because TypeScript doesn't know about SyncManager
        const syncReg = reg as any
        if (syncReg.sync) {
          await syncReg.sync.register('upload-queue')
          debugLog('upload-queue: registered sync event')
        }
      } catch (error) {
        debugWarn('upload-queue: failed to register sync', error)
      }
    }
  } catch (error) {
    debugWarn('upload-queue: failed to enqueue upload', error)
    throw error
  }
}

/**
 * Process pending uploads (called by service worker sync event).
 */
export async function processQueue(): Promise<void> {
  const pending = await dbGetPendingUploads()
  debugLog('upload-queue: processing queue', { count: pending.length })
  
  for (const item of pending) {
    if (item.retryCount >= MAX_RETRY_COUNT) {
      debugLog('upload-queue: skipping item, max retries reached', { id: item.id })
      continue
    }
    
    try {
      // TODO: Replace with actual upload adapter call
      // For now, simulate success after 1s
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      await dbRemoveUpload(item.id!)
      debugLog('upload-queue: upload succeeded', { id: item.id })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const newRetryCount = item.retryCount + 1
      
      await dbUpdateUploadRetry(item.id!, newRetryCount, errorMessage)
      debugWarn('upload-queue: upload failed, updated retry count', { 
        id: item.id, 
        retryCount: newRetryCount,
        error: errorMessage 
      })
      
      if (newRetryCount >= MAX_RETRY_COUNT) {
        debugLog('upload-queue: max retries reached, item will be skipped', { id: item.id })
      }
    }
  }
}

/**
 * Get statistics about the upload queue.
 */
export async function getQueueStats(): Promise<UploadQueueStats> {
  const pending = await dbGetPendingUploads()
  const retrying = pending.filter(item => item.retryCount > 0).length
  
  return {
    pending: pending.length,
    retrying,
    total: pending.length
  }
}

/**
 * Get pending upload count.
 */
export async function getPendingCount(): Promise<number> {
  const pending = await dbGetPendingUploads()
  return pending.length
}

/**
 * Clear all pending uploads.
 */
export async function clearQueue(): Promise<void> {
  const pending = await dbGetPendingUploads()
  await Promise.all(pending.map(item => dbRemoveUpload(item.id!)))
  debugLog('upload-queue: cleared all pending uploads', { count: pending.length })
}