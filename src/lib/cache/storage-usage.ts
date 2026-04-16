import { getFullMediaCacheInfo, getThumbCacheInfo } from './indexeddb'
import { getFullMediaStorageState, getOpfsStorageInfo, isOpfsAvailable, type FullMediaBackend, type FullMediaMigrationStatus } from './opfs'

export interface StorageUsage {
  thumbnailsBytes: number
  thumbnailsCount: number
  indexedDbFullMediaBytes: number
  indexedDbFullMediaCount: number
  opfsBytes: number
  opfsCount: number
  opfsAvailable: boolean
  activeFullMediaBackend: FullMediaBackend
  migrationStatus: FullMediaMigrationStatus
  backendDetail: string | null
  totalBytes: number
  totalCount: number
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const [thumbInfo, indexedDbFullMediaInfo, opfsInfo, fullMediaState] = await Promise.all([
    getThumbCacheInfo(),
    getFullMediaCacheInfo(),
    getOpfsStorageInfo(),
    getFullMediaStorageState(),
  ])

  const totalBytes = thumbInfo.totalBytes + indexedDbFullMediaInfo.totalBytes + opfsInfo.totalBytes
  const totalCount = thumbInfo.itemCount + indexedDbFullMediaInfo.itemCount + opfsInfo.itemCount

  return {
    thumbnailsBytes: thumbInfo.totalBytes,
    thumbnailsCount: thumbInfo.itemCount,
    indexedDbFullMediaBytes: indexedDbFullMediaInfo.totalBytes,
    indexedDbFullMediaCount: indexedDbFullMediaInfo.itemCount,
    opfsBytes: opfsInfo.totalBytes,
    opfsCount: opfsInfo.itemCount,
    opfsAvailable: isOpfsAvailable(),
    activeFullMediaBackend: fullMediaState.activeBackend,
    migrationStatus: fullMediaState.migrationStatus,
    backendDetail: fullMediaState.detail,
    totalBytes,
    totalCount,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export async function getStorageQuota(): Promise<{
  usage: number
  quota: number
  percentage: number
} | null> {
  if (typeof navigator.storage?.estimate !== 'function') {
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    if (estimate.usage === undefined || estimate.quota === undefined) {
      return null
    }

    const usage = estimate.usage
    const quota = estimate.quota
    const percentage = quota > 0 ? (usage / quota) * 100 : 0

    return { usage, quota, percentage }
  } catch {
    return null
  }
}
