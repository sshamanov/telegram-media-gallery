import type { Dialog } from '../../types/telegram'

const DB_NAME = 'telegram-gallery-cache'
const DB_VERSION = 3
const THUMBS = 'thumbnails'
const FULL = 'full-media'
const DIALOG_METADATA = 'dialog-metadata'
const UPLOAD_QUEUE = 'upload-queue'
const PREFETCH_QUEUE = 'prefetch-queue'

type StoreName = typeof THUMBS | typeof FULL | typeof DIALOG_METADATA | typeof UPLOAD_QUEUE | typeof PREFETCH_QUEUE

interface CacheRow {
  id: string
  blob: Blob
  updatedAt: number
}

export interface UploadQueueItem {
  id?: number
  dialogId: string
  file: {
    name: string
    type: string
    size: number
    data: ArrayBuffer
  }
  createdAt: number
  retryCount: number
  lastError: string | null
}

export type PrefetchStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'

export interface PrefetchQueueItem {
  dialogId: string
  status: PrefetchStatus
  totalItems: number
  processedItems: number
  startedAt: number
  completedAt: number | null
  error: string | null
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = request.result
        const oldVersion = event.oldVersion
        
        // Version 1 → 2: added DIALOG_METADATA
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(DIALOG_METADATA)) {
            db.createObjectStore(DIALOG_METADATA, { keyPath: 'id' })
          }
        }
        
        // Version 2 → 3: add UPLOAD_QUEUE and PREFETCH_QUEUE
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(UPLOAD_QUEUE)) {
            db.createObjectStore(UPLOAD_QUEUE, { keyPath: 'id', autoIncrement: true })
          }
          if (!db.objectStoreNames.contains(PREFETCH_QUEUE)) {
            db.createObjectStore(PREFETCH_QUEUE, { keyPath: 'dialogId' })
          }
        }
        
        // Ensure all stores exist (backward compatibility)
        if (!db.objectStoreNames.contains(THUMBS)) {
          db.createObjectStore(THUMBS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(FULL)) {
          db.createObjectStore(FULL, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(DIALOG_METADATA)) {
          db.createObjectStore(DIALOG_METADATA, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })
  }

  return dbPromise
}

async function withStore<T>(storeName: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
  const db = await getDb()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)

    run(store, resolve, reject)

    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function readCachedBlob(id: string, kind: 'thumb' | 'full'): Promise<Blob | null> {
  return withStore(kind === 'thumb' ? THUMBS : FULL, 'readonly', (store, resolve) => {
    const request = store.get(id)
    request.onsuccess = () => resolve((request.result as CacheRow | undefined)?.blob ?? null)
    request.onerror = () => resolve(null)
  })
}

export async function writeCachedBlob(id: string, blob: Blob, kind: 'thumb' | 'full'): Promise<void> {
  return withStore(kind === 'thumb' ? THUMBS : FULL, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ id, blob, updatedAt: Date.now() } satisfies CacheRow)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to write cache entry'))
  })
}

export interface CacheEntry {
  id: string
  blob: Blob
  updatedAt: number
}

export async function listAllFullMedia(): Promise<CacheEntry[]> {
  return withStore<CacheEntry[]>(FULL, 'readonly', (store, resolve) => {
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result as CacheEntry[]) ?? [])
    request.onerror = () => resolve([])
  })
}

export async function deleteCachedBlobById(id: string, kind: 'thumb' | 'full'): Promise<void> {
  return withStore(kind === 'thumb' ? THUMBS : FULL, 'readwrite', (store, resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to delete cache entry'))
  })
}

export async function getThumbCacheInfo(): Promise<{ itemCount: number; totalBytes: number }> {
  const entries = await withStore<CacheEntry[]>(THUMBS, 'readonly', (store, resolve) => {
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result as CacheEntry[]) ?? [])
    request.onerror = () => resolve([])
  })

  const totalBytes = entries.reduce((sum, entry) => sum + entry.blob.size, 0)
  return { itemCount: entries.length, totalBytes }
}

export async function getFullMediaCacheInfo(): Promise<{ itemCount: number; totalBytes: number }> {
  const entries = await withStore<CacheEntry[]>(FULL, 'readonly', (store, resolve) => {
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result as CacheEntry[]) ?? [])
    request.onerror = () => resolve([])
  })

  const totalBytes = entries.reduce((sum, entry) => sum + entry.blob.size, 0)
  return { itemCount: entries.length, totalBytes }
}

export async function readCachedDialogs(): Promise<Dialog[] | null> {
  const row = await withStore<{ id: string; dialogs: Dialog[]; cachedAt: number } | null>(DIALOG_METADATA, 'readonly', (store, resolve) => {
    const request = store.get('dialogs')
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => resolve(null)
  })

  if (!row) return null

  // 5-minute TTL
  if (Date.now() - row.cachedAt > 5 * 60 * 1000) {
    return null
  }

  return row.dialogs
}

export async function writeCachedDialogs(dialogs: Dialog[]): Promise<void> {
  await withStore(DIALOG_METADATA, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ id: 'dialogs', dialogs, cachedAt: Date.now() })
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to write dialog cache'))
  })
}

export async function clearDialogCache(): Promise<void> {
  await withStore(DIALOG_METADATA, 'readwrite', (store, resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to clear dialog cache'))
  })
}

// Upload Queue Functions
export async function enqueueUpload(item: Omit<UploadQueueItem, 'id' | 'createdAt' | 'retryCount' | 'lastError'>): Promise<number> {
  return withStore<number>(UPLOAD_QUEUE, 'readwrite', (store, resolve, reject) => {
    const fullItem: UploadQueueItem = {
      ...item,
      createdAt: Date.now(),
      retryCount: 0,
      lastError: null
    }
    const request = store.add(fullItem)
    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error ?? new Error('Failed to enqueue upload'))
  })
}

export async function getPendingUploads(): Promise<UploadQueueItem[]> {
  return withStore<UploadQueueItem[]>(UPLOAD_QUEUE, 'readonly', (store, resolve) => {
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result as UploadQueueItem[]) ?? [])
    request.onerror = () => resolve([])
  })
}

export async function removeUpload(id: number): Promise<void> {
  return withStore(UPLOAD_QUEUE, 'readwrite', (store, resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to remove upload'))
  })
}

export async function updateUploadRetry(id: number, retryCount: number, lastError: string | null): Promise<void> {
  return withStore(UPLOAD_QUEUE, 'readwrite', (store, resolve, reject) => {
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const item = getRequest.result as UploadQueueItem
      if (!item) {
        reject(new Error('Upload item not found'))
        return
      }
      item.retryCount = retryCount
      item.lastError = lastError
      const putRequest = store.put(item)
      putRequest.onsuccess = () => resolve(undefined)
      putRequest.onerror = () => reject(putRequest.error ?? new Error('Failed to update upload'))
    }
    getRequest.onerror = () => reject(getRequest.error ?? new Error('Failed to get upload item'))
  })
}

// Prefetch Queue Functions
export async function upsertPrefetch(item: PrefetchQueueItem): Promise<void> {
  return withStore(PREFETCH_QUEUE, 'readwrite', (store, resolve, reject) => {
    const request = store.put(item)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to upsert prefetch'))
  })
}

export async function getPrefetch(dialogId: string): Promise<PrefetchQueueItem | null> {
  return withStore<PrefetchQueueItem | null>(PREFETCH_QUEUE, 'readonly', (store, resolve) => {
    const request = store.get(dialogId)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => resolve(null)
  })
}

export async function getAllPrefetches(): Promise<PrefetchQueueItem[]> {
  return withStore<PrefetchQueueItem[]>(PREFETCH_QUEUE, 'readonly', (store, resolve) => {
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result as PrefetchQueueItem[]) ?? [])
    request.onerror = () => resolve([])
  })
}

export async function removePrefetch(dialogId: string): Promise<void> {
  return withStore(PREFETCH_QUEUE, 'readwrite', (store, resolve, reject) => {
    const request = store.delete(dialogId)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to remove prefetch'))
  })
}