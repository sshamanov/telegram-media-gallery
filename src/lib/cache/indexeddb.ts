import type { Dialog } from '../../types/telegram'

const DB_NAME = 'telegram-gallery-cache'
const DB_VERSION = 2
const THUMBS = 'thumbnails'
const FULL = 'full-media'
const DIALOG_METADATA = 'dialog-metadata'

type StoreName = typeof THUMBS | typeof FULL | typeof DIALOG_METADATA

interface CacheRow {
  id: string
  blob: Blob
  updatedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
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
  return {
    itemCount: entries.length,
    totalBytes: entries.reduce((sum, e) => sum + e.blob.size, 0),
  }
}

export async function getFullMediaCacheInfo(): Promise<{ itemCount: number; totalBytes: number }> {
  const entries = await withStore<CacheEntry[]>(FULL, 'readonly', (store, resolve) => {
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result as CacheEntry[]) ?? [])
    request.onerror = () => resolve([])
  })

  return {
    itemCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.blob.size, 0),
  }
}

export async function clearFullMediaCache(): Promise<void> {
  await withStore(FULL, 'readwrite', (store, resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to clear full-media cache'))
  })
}

export async function clearThumbnailCache(): Promise<void> {
  await withStore(THUMBS, 'readwrite', (store, resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to clear thumbnail cache'))
  })
}

export async function clearAllCachedMedia(): Promise<void> {
  await Promise.all([
    clearThumbnailCache(),
    clearFullMediaCache(),
  ])
}

export interface DialogCacheRow {
  id: 'dialogs'  // single entry for the whole list
  dialogs: Dialog[]
  updatedAt: number
}

export async function readCachedDialogs(): Promise<DialogCacheRow | null> {
  return withStore<DialogCacheRow | null>(DIALOG_METADATA, 'readonly', (store, resolve) => {
    const request = store.get('dialogs')
    request.onsuccess = () => resolve((request.result as DialogCacheRow | undefined) ?? null)
    request.onerror = () => resolve(null)
  })
}

export async function writeCachedDialogs(dialogs: Dialog[]): Promise<void> {
  return withStore(DIALOG_METADATA, 'readwrite', (store, resolve, reject) => {
    const request = store.put({
      id: 'dialogs',
      dialogs,
      updatedAt: Date.now(),
    } satisfies DialogCacheRow)
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
