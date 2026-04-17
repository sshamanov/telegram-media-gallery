import { readCachedBlob, writeCachedBlob } from './cache/indexeddb'
import { readFullMediaBlob, writeFullMediaBlob } from './cache/opfs'
import { getTelegramAdapter } from './telegram/adapter'
import { emit } from './events'
import type { MediaItem } from '../types/telegram'

export type CachedMediaKind = 'thumb' | 'full'

function isOfflineRuntime(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function cloneBufferToBlob(buffer: Uint8Array, type: string): Blob {
  return new Blob([buffer as BlobPart], { type })
}

export function throttle<T extends (...args: any[]) => any>(fn: T, interval: number): T {
  let lastCall = 0
  let timeout: number | undefined
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= interval) {
      lastCall = now
      fn(...args)
    } else {
      if (timeout) window.clearTimeout(timeout)
      timeout = window.setTimeout(() => {
        lastCall = Date.now()
        fn(...args)
      }, interval - (now - lastCall))
    }
  }) as T
}

export function mediaCacheKey(item: MediaItem, kind: CachedMediaKind): string {
  return `${item.dialogId}:${item.messageId}:${kind}`
}

export async function getCachedBlob(item: MediaItem, kind: CachedMediaKind): Promise<Blob | null> {
  const cacheKey = mediaCacheKey(item, kind)

  if (kind === 'full') {
    return readFullMediaBlob(cacheKey, item.dialogId, item.messageId, item.mimeType || 'application/octet-stream')
  }

  return readCachedBlob(cacheKey, kind)
}

export async function writeMediaBlobToCache(item: MediaItem, kind: CachedMediaKind, blob: Blob): Promise<void> {
  const cacheKey = mediaCacheKey(item, kind)

  if (kind === 'full') {
    await writeFullMediaBlob(cacheKey, item.dialogId, item.messageId, item.mimeType || 'application/octet-stream', blob)
    return
  }

  await writeCachedBlob(cacheKey, blob, kind)
}

/**
 * Returns a cached blob for the item, or downloads and caches it.
 * Full media: OPFS (Phase 3) when available, else IndexedDB.
 * Thumbnails: always IndexedDB.
 */
export async function getCachedOrDownloadBlob(
  item: MediaItem,
  kind: CachedMediaKind,
  opts?: { onProgress?: (pct: number) => void; abortSignal?: AbortSignal },
): Promise<Blob | null> {
  const mimeType = kind === 'thumb' ? 'image/jpeg' : item.mimeType || 'application/octet-stream'

  // --- read from cache ---
  const cachedBlob = await getCachedBlob(item, kind)
  if (cachedBlob) {
    return cachedBlob
  }

  if (isOfflineRuntime()) {
    return null
  }

  // --- download ---
  const adapter = getTelegramAdapter()
  const buffer = kind === 'thumb'
    ? await adapter.downloadThumbnail(item.media)
    : await adapter.downloadFull(item.media, opts?.onProgress, opts?.abortSignal)

  if (!buffer) return null

  const blob = cloneBufferToBlob(buffer, mimeType)

  // --- write to cache ---
  await writeMediaBlobToCache(item, kind, blob)
  if (kind === 'full') {
    emit('media:full-downloaded', item.media.id)
  }

  return blob
}

export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
}

export async function saveBlob(blob: Blob, fileName: string, directoryHandle?: FileSystemDirectoryHandle): Promise<void> {
  if (directoryHandle && 'showDirectoryPicker' in window) {
    try {
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (error) {
      console.warn('Failed to save via File System Access API, falling back to download:', error)
    }
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function requestDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window) || !window.showDirectoryPicker) {
    return null
  }

  try {
    return await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    console.warn('Failed to request directory:', error)
    return null
  }
}

export function parseFloodWaitSeconds(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/FLOOD_WAIT(?:_|\s)(\d+)/)
  if (!match) return null
  const seconds = Number(match[1])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('AbortError') || message.includes('aborted')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
