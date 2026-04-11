import { readCachedBlob, writeCachedBlob } from './cache/indexeddb'
import { getTelegramAdapter } from './telegram/adapter'
import type { MediaItem } from '../types/telegram'

export type CachedMediaKind = 'thumb' | 'full'

function cloneBufferToBlob(buffer: Uint8Array, type: string): Blob {
  const cloned = new Uint8Array(buffer.byteLength)
  cloned.set(buffer)
  return new Blob([cloned], { type })
}

export function mediaCacheKey(item: MediaItem, kind: CachedMediaKind): string {
  return `${item.dialogId}:${item.messageId}:${kind}`
}

export async function getCachedOrDownloadBlob(
  item: MediaItem,
  kind: CachedMediaKind,
  opts?: { onProgress?: (pct: number) => void; abortSignal?: AbortSignal },
): Promise<Blob | null> {
  const cacheKey = mediaCacheKey(item, kind)
  const cached = await readCachedBlob(cacheKey, kind)
  if (cached) {
    return cached
  }

  const adapter = getTelegramAdapter()
  const buffer = kind === 'thumb'
    ? await adapter.downloadThumbnail(item.media)
    : await adapter.downloadFull(item.media, opts?.onProgress, opts?.abortSignal)

  if (!buffer) {
    return null
  }

  const mimeType = kind === 'thumb' ? 'image/jpeg' : item.mimeType || 'application/octet-stream'
  const blob = cloneBufferToBlob(buffer, mimeType)
  await writeCachedBlob(cacheKey, blob, kind)
  return blob
}

export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function parseFloodWaitSeconds(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/FLOOD_WAIT(?:_|\s)(\d+)/)
  if (!match) {
    return null
  }

  const seconds = Number(match[1])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return message.includes('AbortError') || message.includes('aborted')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
