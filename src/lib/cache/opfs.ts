/**
 * OPFS (Origin Private File System) cache for full media files.
 * Phase 3+. Falls back gracefully when OPFS is unavailable.
 *
 * Structure:
 *   OPFS root/
 *     media/
 *       {dialogId}/
 *         {messageId}.{ext}
 */

const MEDIA_DIR = 'media'

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null

function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (!rootPromise) {
    rootPromise = navigator.storage.getDirectory()
  }
  return rootPromise
}

export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  )
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
  }
  return map[mimeType] ?? 'bin'
}

function opfsKey(_dialogId: string, messageId: number, mimeType: string): string {
  return `${messageId}.${extFromMime(mimeType)}`
}

async function getDialogDir(dialogId: string): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot()
  const mediaDir = await root.getDirectoryHandle(MEDIA_DIR, { create: true })
  return mediaDir.getDirectoryHandle(dialogId, { create: true })
}

export async function readOpfsBlob(
  dialogId: string,
  messageId: number,
  mimeType: string,
): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null
  try {
    const dir = await getDialogDir(dialogId)
    const fileName = opfsKey(dialogId, messageId, mimeType)
    const handle = await dir.getFileHandle(fileName)
    return await handle.getFile()
  } catch {
    return null
  }
}

export async function writeOpfsBlob(
  dialogId: string,
  messageId: number,
  mimeType: string,
  blob: Blob,
): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const dir = await getDialogDir(dialogId)
    const fileName = opfsKey(dialogId, messageId, mimeType)
    const handle = await dir.getFileHandle(fileName, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  } catch {
    // Storage full or permission denied — fail silently, item remains uncached
  }
}

export async function deleteOpfsBlob(
  dialogId: string,
  messageId: number,
  mimeType: string,
): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const dir = await getDialogDir(dialogId)
    const fileName = opfsKey(dialogId, messageId, mimeType)
    await dir.removeEntry(fileName)
  } catch {
    // Already gone
  }
}

export interface OpfsStorageInfo {
  itemCount: number
  totalBytes: number
}

export async function getOpfsStorageInfo(): Promise<OpfsStorageInfo> {
  if (!isOpfsAvailable()) return { itemCount: 0, totalBytes: 0 }
  let itemCount = 0
  let totalBytes = 0
  try {
    const root = await getRoot()
    const mediaDir = await root.getDirectoryHandle(MEDIA_DIR, { create: true })
    for await (const [, dialogDirHandle] of mediaDir) {
      if (dialogDirHandle.kind !== 'directory') continue
      for await (const [, fileHandle] of dialogDirHandle as FileSystemDirectoryHandle) {
        if (fileHandle.kind !== 'file') continue
        const file = await (fileHandle as FileSystemFileHandle).getFile()
        itemCount++
        totalBytes += file.size
      }
    }
  } catch {
    // Ignore errors during enumeration
  }
  return { itemCount, totalBytes }
}

export async function clearOpfsMedia(): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const root = await getRoot()
    await root.removeEntry(MEDIA_DIR, { recursive: true })
    rootPromise = null // reset so next call re-opens
  } catch {
    // Already empty
  }
}

/**
 * Iterate all full-media entries stored in IndexedDB and migrate them to OPFS.
 * Each successfully migrated entry is deleted from IndexedDB.
 * Skips entries that already exist in OPFS.
 *
 * @param onProgress called with (migrated, total)
 * @returns number of successfully migrated entries
 */
export async function migrateIndexedDbToOpfs(
  onProgress: (migrated: number, total: number) => void,
): Promise<number> {
  if (!isOpfsAvailable()) return 0

  // Import IndexedDB helpers lazily to avoid circular deps
  const { listAllFullMedia, deleteCachedBlobById } = await import('./indexeddb')
  const entries = await listAllFullMedia()
  let migrated = 0

  for (const entry of entries) {
    // Key format: "dialogId:messageId:full"
    const parts = entry.id.split(':')
    if (parts.length < 3) {
      migrated++
      onProgress(migrated, entries.length)
      continue
    }
    const [dialogId, messageIdStr] = parts
    const messageId = Number(messageIdStr)
    const mimeType = entry.blob.type || 'application/octet-stream'

    // Skip if already in OPFS
    const existing = await readOpfsBlob(dialogId, messageId, mimeType)
    if (existing) {
      await deleteCachedBlobById(entry.id, 'full')
      migrated++
      onProgress(migrated, entries.length)
      continue
    }

    try {
      await writeOpfsBlob(dialogId, messageId, mimeType, entry.blob)
      await deleteCachedBlobById(entry.id, 'full')
    } catch {
      // Partial migration is fine — item will be re-downloaded on demand
    }
    migrated++
    onProgress(migrated, entries.length)
  }

  return migrated
}
