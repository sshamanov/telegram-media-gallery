import {
  deleteCachedBlobById,
  getFullMediaCacheInfo,
  readCachedBlob,
  writeCachedBlob,
} from './indexeddb'

const MEDIA_DIR = 'media'
const PROBE_DIR = '.opfs-probe'
const STORAGE_STATE_KEY = 'full-media-storage-v1'

export type FullMediaBackend = 'opfs' | 'indexeddb'
export type FullMediaMigrationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'unsupported'
  | 'fallback'

export interface FullMediaStorageState {
  version: 1
  activeBackend: FullMediaBackend
  migrationStatus: FullMediaMigrationStatus
  processedEntries: number
  totalEntries: number
  migratedEntries: number
  failedEntries: number
  remainingEntries: number
  lastError: string | null
  detail: string | null
  updatedAt: string | null
}

export interface OpfsStorageInfo {
  itemCount: number
  totalBytes: number
}

interface OpfsCapability {
  supported: boolean
  usable: boolean
  detail: string | null
}

interface MigrationProgress {
  processedEntries: number
  totalEntries: number
  migratedEntries: number
  failedEntries: number
}

interface MigrationResult extends MigrationProgress {
  remainingEntries: number
  detail: string | null
}

const defaultStorageState: FullMediaStorageState = {
  version: 1,
  activeBackend: 'indexeddb',
  migrationStatus: 'pending',
  processedEntries: 0,
  totalEntries: 0,
  migratedEntries: 0,
  failedEntries: 0,
  remainingEntries: 0,
  lastError: null,
  detail: null,
  updatedAt: null,
}

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null
let capabilityPromise: Promise<OpfsCapability> | null = null

function readStoredState(): FullMediaStorageState {
  if (typeof localStorage === 'undefined') {
    return defaultStorageState
  }

  const raw = localStorage.getItem(STORAGE_STATE_KEY)
  if (!raw) {
    return defaultStorageState
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FullMediaStorageState>
    return {
      ...defaultStorageState,
      ...parsed,
      version: 1,
    }
  } catch {
    return defaultStorageState
  }
}

function persistState(partial: Partial<FullMediaStorageState>): FullMediaStorageState {
  const next: FullMediaStorageState = {
    ...readStoredState(),
    ...partial,
    version: 1,
    updatedAt: new Date().toISOString(),
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(next))
  }

  return next
}

function opfsKey(_dialogId: string, messageId: number, mimeType: string): string {
  return `${messageId}.${extFromMime(mimeType)}`
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

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return String(error)
}

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (!rootPromise) {
    rootPromise = navigator.storage.getDirectory()
  }

  return rootPromise
}

async function probeOpfsCapability(): Promise<OpfsCapability> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.storage?.getDirectory !== 'function'
  ) {
    return {
      supported: false,
      usable: false,
      detail: 'OPFS API is unavailable in this browser.',
    }
  }

  try {
    const root = await getRoot()
    await root.getDirectoryHandle(PROBE_DIR, { create: true })
    await root.removeEntry(PROBE_DIR, { recursive: true })

    return {
      supported: true,
      usable: true,
      detail: null,
    }
  } catch (error) {
    rootPromise = null

    return {
      supported: true,
      usable: false,
      detail: `OPFS probe failed: ${toErrorMessage(error)}`,
    }
  }
}

async function getOpfsCapability(): Promise<OpfsCapability> {
  if (!capabilityPromise) {
    capabilityPromise = probeOpfsCapability()
  }

  return capabilityPromise
}

async function getDialogDir(dialogId: string): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot()
  const mediaDir = await root.getDirectoryHandle(MEDIA_DIR, { create: true })
  return mediaDir.getDirectoryHandle(dialogId, { create: true })
}

async function tryWriteOpfsBlob(
  dialogId: string,
  messageId: number,
  mimeType: string,
  blob: Blob,
): Promise<boolean> {
  try {
    const dir = await getDialogDir(dialogId)
    const fileName = opfsKey(dialogId, messageId, mimeType)
    const handle = await dir.getFileHandle(fileName, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch {
    return false
  }
}

export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  )
}

export function getStoredFullMediaStorageState(): FullMediaStorageState {
  return readStoredState()
}

export async function getFullMediaBackend(): Promise<FullMediaBackend> {
  const capability = await getOpfsCapability()
  return capability.usable ? 'opfs' : 'indexeddb'
}

export async function getFullMediaStorageState(): Promise<FullMediaStorageState> {
  const [capability, indexedDbInfo] = await Promise.all([
    getOpfsCapability(),
    getFullMediaCacheInfo(),
  ])
  const stored = readStoredState()

  if (!capability.supported) {
    return persistState({
      activeBackend: 'indexeddb',
      migrationStatus: 'unsupported',
      processedEntries: 0,
      totalEntries: indexedDbInfo.itemCount,
      migratedEntries: 0,
      failedEntries: 0,
      remainingEntries: indexedDbInfo.itemCount,
      lastError: null,
      detail: capability.detail,
    })
  }

  if (!capability.usable) {
    return persistState({
      activeBackend: 'indexeddb',
      migrationStatus: 'fallback',
      processedEntries: 0,
      totalEntries: indexedDbInfo.itemCount,
      migratedEntries: 0,
      failedEntries: 0,
      remainingEntries: indexedDbInfo.itemCount,
      lastError: capability.detail,
      detail: capability.detail,
    })
  }

  if (indexedDbInfo.itemCount === 0) {
    return persistState({
      ...stored,
      activeBackend: 'opfs',
      migrationStatus: 'completed',
      remainingEntries: 0,
      failedEntries: 0,
      lastError: null,
      detail: stored.detail ?? 'OPFS is active for new full-media downloads.',
    })
  }

  if (stored.migrationStatus === 'completed' && indexedDbInfo.itemCount > 0) {
    return persistState({
      activeBackend: 'opfs',
      migrationStatus: 'partial',
      totalEntries: Math.max(stored.totalEntries, indexedDbInfo.itemCount),
      remainingEntries: indexedDbInfo.itemCount,
      failedEntries: indexedDbInfo.itemCount,
      detail: `${indexedDbInfo.itemCount} full-media items remain in IndexedDB and will retry on next launch.`,
    })
  }

  return persistState({
    ...stored,
    activeBackend: 'opfs',
    remainingEntries: indexedDbInfo.itemCount,
    totalEntries: Math.max(stored.totalEntries, indexedDbInfo.itemCount),
  })
}

export async function readOpfsBlob(
  dialogId: string,
  messageId: number,
  mimeType: string,
): Promise<Blob | null> {
  const capability = await getOpfsCapability()
  if (!capability.usable) return null

  try {
    const dir = await getDialogDir(dialogId)
    const fileName = opfsKey(dialogId, messageId, mimeType)
    const handle = await dir.getFileHandle(fileName)
    return await handle.getFile()
  } catch {
    return null
  }
}

export async function readFullMediaBlob(
  cacheKey: string,
  dialogId: string,
  messageId: number,
  mimeType: string,
): Promise<Blob | null> {
  const opfsBlob = await readOpfsBlob(dialogId, messageId, mimeType)
  if (opfsBlob) {
    return opfsBlob
  }

  return readCachedBlob(cacheKey, 'full')
}

export async function writeOpfsBlob(
  dialogId: string,
  messageId: number,
  mimeType: string,
  blob: Blob,
): Promise<boolean> {
  const capability = await getOpfsCapability()
  if (!capability.usable) return false
  return tryWriteOpfsBlob(dialogId, messageId, mimeType, blob)
}

export async function writeFullMediaBlob(
  cacheKey: string,
  dialogId: string,
  messageId: number,
  mimeType: string,
  blob: Blob,
): Promise<FullMediaStorageState> {
  const capability = await getOpfsCapability()

  if (capability.usable) {
    const written = await tryWriteOpfsBlob(dialogId, messageId, mimeType, blob)
    if (written) {
      return persistState({
        ...readStoredState(),
        activeBackend: 'opfs',
        migrationStatus: readStoredState().remainingEntries > 0 ? 'partial' : 'completed',
        lastError: null,
        detail:
          readStoredState().remainingEntries > 0
            ? `${readStoredState().remainingEntries} full-media items remain in IndexedDB and will retry on next launch.`
            : 'OPFS is active for new full-media downloads.',
      })
    }
  }

  await writeCachedBlob(cacheKey, blob, 'full')

  const fallbackDetail = capability.supported
    ? capability.usable
      ? 'OPFS write failed, so the item was stored in IndexedDB fallback.'
      : capability.detail
    : 'OPFS API is unavailable in this browser.'

  return persistState({
    ...readStoredState(),
    activeBackend: capability.usable ? 'opfs' : 'indexeddb',
    migrationStatus: capability.usable ? 'partial' : capability.supported ? 'fallback' : 'unsupported',
    lastError: fallbackDetail,
    detail: fallbackDetail,
  })
}

export async function deleteOpfsBlob(
  dialogId: string,
  messageId: number,
  mimeType: string,
): Promise<void> {
  const capability = await getOpfsCapability()
  if (!capability.usable) return

  try {
    const dir = await getDialogDir(dialogId)
    const fileName = opfsKey(dialogId, messageId, mimeType)
    await dir.removeEntry(fileName)
  } catch {
    // Already gone.
  }
}

export async function getOpfsStorageInfo(): Promise<OpfsStorageInfo> {
  const capability = await getOpfsCapability()
  if (!capability.usable) return { itemCount: 0, totalBytes: 0 }

  let itemCount = 0
  let totalBytes = 0

  try {
    const root = await getRoot()
    const mediaDir = await root.getDirectoryHandle(MEDIA_DIR, { create: false })

    for await (const [, dialogDirHandle] of mediaDir) {
      if (dialogDirHandle.kind !== 'directory') continue

      for await (const [, fileHandle] of dialogDirHandle as FileSystemDirectoryHandle) {
        if (fileHandle.kind !== 'file') continue
        const file = await (fileHandle as FileSystemFileHandle).getFile()
        itemCount += 1
        totalBytes += file.size
      }
    }
  } catch (error) {
    if (!isNotFoundError(error)) {
      rootPromise = null
    }
  }

  return { itemCount, totalBytes }
}

export async function clearOpfsMedia(): Promise<void> {
  const capability = await getOpfsCapability()
  if (!capability.usable) return

  try {
    const root = await getRoot()
    await root.removeEntry(MEDIA_DIR, { recursive: true })
    rootPromise = null
  } catch (error) {
    if (!isNotFoundError(error)) {
      rootPromise = null
    }
  }
}

export async function migrateIndexedDbToOpfs(
  onProgress: (progress: MigrationProgress) => void,
): Promise<MigrationResult> {
  const capability = await getOpfsCapability()
  if (!capability.usable) {
    return {
      processedEntries: 0,
      totalEntries: 0,
      migratedEntries: 0,
      failedEntries: 0,
      remainingEntries: (await getFullMediaCacheInfo()).itemCount,
      detail: capability.detail,
    }
  }

  const { listAllFullMedia } = await import('./indexeddb')
  const entries = await listAllFullMedia()

  let processedEntries = 0
  let migratedEntries = 0
  let failedEntries = 0

  for (const entry of entries) {
    const parts = entry.id.split(':')
    if (parts.length < 3) {
      processedEntries += 1
      failedEntries += 1
      onProgress({
        processedEntries,
        totalEntries: entries.length,
        migratedEntries,
        failedEntries,
      })
      continue
    }

    const [dialogId, messageIdStr] = parts
    const messageId = Number(messageIdStr)
    const mimeType = entry.blob.type || 'application/octet-stream'

    const existing = await readOpfsBlob(dialogId, messageId, mimeType)
    const migrated = existing || (await tryWriteOpfsBlob(dialogId, messageId, mimeType, entry.blob))

    if (migrated) {
      try {
        await deleteCachedBlobById(entry.id, 'full')
        migratedEntries += 1
      } catch {
        failedEntries += 1
      }
    } else {
      failedEntries += 1
    }

    processedEntries += 1
    onProgress({
      processedEntries,
      totalEntries: entries.length,
      migratedEntries,
      failedEntries,
    })
  }

  const remainingEntries = (await getFullMediaCacheInfo()).itemCount
  const detail =
    failedEntries > 0
      ? `${remainingEntries} full-media items remain in IndexedDB and will retry on next launch.`
      : entries.length > 0
        ? 'IndexedDB full-media entries migrated to OPFS.'
        : 'No IndexedDB full-media entries needed migration.'

  return {
    processedEntries,
    totalEntries: entries.length,
    migratedEntries,
    failedEntries,
    remainingEntries,
    detail,
  }
}

export async function initializeFullMediaStorage(
  onProgress?: (state: FullMediaStorageState) => void,
): Promise<FullMediaStorageState> {
  const capability = await getOpfsCapability()
  const fullMediaInfo = await getFullMediaCacheInfo()

  if (!capability.supported) {
    const next = persistState({
      activeBackend: 'indexeddb',
      migrationStatus: 'unsupported',
      processedEntries: 0,
      totalEntries: fullMediaInfo.itemCount,
      migratedEntries: 0,
      failedEntries: 0,
      remainingEntries: fullMediaInfo.itemCount,
      lastError: null,
      detail: capability.detail,
    })
    onProgress?.(next)
    return next
  }

  if (!capability.usable) {
    const next = persistState({
      activeBackend: 'indexeddb',
      migrationStatus: 'fallback',
      processedEntries: 0,
      totalEntries: fullMediaInfo.itemCount,
      migratedEntries: 0,
      failedEntries: 0,
      remainingEntries: fullMediaInfo.itemCount,
      lastError: capability.detail,
      detail: capability.detail,
    })
    onProgress?.(next)
    return next
  }

  if (fullMediaInfo.itemCount === 0) {
    const next = persistState({
      activeBackend: 'opfs',
      migrationStatus: 'completed',
      processedEntries: 0,
      totalEntries: 0,
      migratedEntries: 0,
      failedEntries: 0,
      remainingEntries: 0,
      lastError: null,
      detail: 'OPFS is active for new full-media downloads.',
    })
    onProgress?.(next)
    return next
  }

  const running = persistState({
    activeBackend: 'opfs',
    migrationStatus: 'running',
    processedEntries: 0,
    totalEntries: fullMediaInfo.itemCount,
    migratedEntries: 0,
    failedEntries: 0,
    remainingEntries: fullMediaInfo.itemCount,
    lastError: null,
    detail: 'Migrating IndexedDB full-media cache to OPFS.',
  })
  onProgress?.(running)

  const result = await migrateIndexedDbToOpfs((progress) => {
    onProgress?.(
      persistState({
        activeBackend: 'opfs',
        migrationStatus: 'running',
        processedEntries: progress.processedEntries,
        totalEntries: progress.totalEntries,
        migratedEntries: progress.migratedEntries,
        failedEntries: progress.failedEntries,
        remainingEntries: Math.max(progress.totalEntries - progress.migratedEntries, 0),
        lastError: null,
        detail: 'Migrating IndexedDB full-media cache to OPFS.',
      }),
    )
  })

  const next = persistState({
    activeBackend: 'opfs',
    migrationStatus: result.failedEntries > 0 ? 'partial' : 'completed',
    processedEntries: result.processedEntries,
    totalEntries: result.totalEntries,
    migratedEntries: result.migratedEntries,
    failedEntries: result.failedEntries,
    remainingEntries: result.remainingEntries,
    lastError: result.failedEntries > 0 ? result.detail : null,
    detail: result.detail,
  })
  onProgress?.(next)

  return next
}
