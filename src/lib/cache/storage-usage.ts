/**
 * Estimate storage usage for cache systems
 */

import { getThumbCacheInfo } from './indexeddb'
import { isOpfsAvailable } from './opfs'

export interface StorageUsage {
  /** Total bytes used by thumbnails in IndexedDB */
  thumbnailsBytes: number
  /** Number of thumbnail items in IndexedDB */
  thumbnailsCount: number
  /** Whether OPFS is available */
  opfsAvailable: boolean
  /** Estimated bytes used by OPFS (if available) */
  opfsBytes?: number
  /** Estimated number of items in OPFS (if available) */
  opfsCount?: number
  /** Total estimated bytes across all storage systems */
  totalBytes: number
  /** Total estimated items across all storage systems */
  totalCount: number
}

/**
 * Estimate OPFS storage usage (approximate)
 */
async function estimateOpfsUsage(): Promise<{ bytes: number; count: number }> {
  if (!isOpfsAvailable()) {
    return { bytes: 0, count: 0 }
  }
  
  try {
    const root = await navigator.storage.getDirectory()
    const mediaDir = await root.getDirectoryHandle('media', { create: false })
    
    let totalBytes = 0
    let totalCount = 0
    
    // Iterate through dialog directories
    for await (const entry of mediaDir.values()) {
      if (entry.kind === 'directory') {
        // Count files in each dialog directory
        for await (const fileEntry of (entry as FileSystemDirectoryHandle).values()) {
          if (fileEntry.kind === 'file') {
            totalCount++
            // Get file size (approximate - we don't read the file)
            try {
              const file = await (fileEntry as FileSystemFileHandle).getFile()
              totalBytes += file.size
            } catch {
              // Skip files we can't read
            }
          }
        }
      }
    }
    
    return { bytes: totalBytes, count: totalCount }
  } catch {
    // OPFS not accessible or no media directory
    return { bytes: 0, count: 0 }
  }
}

/**
 * Get storage usage estimate
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  const [thumbInfo, opfsInfo] = await Promise.all([
    getThumbCacheInfo(),
    estimateOpfsUsage()
  ])
  
  const totalBytes = thumbInfo.totalBytes + opfsInfo.bytes
  const totalCount = thumbInfo.itemCount + opfsInfo.count
  
  return {
    thumbnailsBytes: thumbInfo.totalBytes,
    thumbnailsCount: thumbInfo.itemCount,
    opfsAvailable: isOpfsAvailable(),
    opfsBytes: opfsInfo.bytes,
    opfsCount: opfsInfo.count,
    totalBytes,
    totalCount
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Get storage quota information (if supported)
 */
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