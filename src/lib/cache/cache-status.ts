/**
 * Cache status tracking for media items
 */

import { writable, derived } from 'svelte/store'
import { readCachedBlob } from './indexeddb'
import { readOpfsBlob } from './opfs'
import type { MediaItem } from '../../types/telegram'

export type CacheStatus = 'cached' | 'downloading' | 'remote' | 'unknown'

export interface MediaCacheStatus {
  itemId: string
  thumbnail: CacheStatus
  fullMedia: CacheStatus
  lastChecked: number
}

// Store for tracking cache status
const cacheStatusStore = writable<Map<string, MediaCacheStatus>>(new Map())

// Store for downloading items
const downloadingItems = writable<Set<string>>(new Set())

/**
 * Check cache status for a media item
 */
export async function checkMediaCacheStatus(item: MediaItem): Promise<MediaCacheStatus> {
  const itemId = item.id
  const now = Date.now()
  
  // Check thumbnail cache
  let thumbnailStatus: CacheStatus = 'unknown'
  try {
    const thumbBlob = await readCachedBlob(itemId, 'thumb')
    thumbnailStatus = thumbBlob ? 'cached' : 'remote'
  } catch {
    thumbnailStatus = 'unknown'
  }
  
  // Check full media cache
  let fullMediaStatus: CacheStatus = 'unknown'
  try {
    const fullBlob = await readOpfsBlob(item.dialogId, item.messageId, item.mimeType || 'application/octet-stream')
    fullMediaStatus = fullBlob ? 'cached' : 'remote'
  } catch {
    fullMediaStatus = 'unknown'
  }
  
  // Check if item is currently downloading
  let isDownloading = false
  downloadingItems.update(set => {
    isDownloading = set.has(itemId)
    return set
  })
  
  if (isDownloading) {
    if (fullMediaStatus === 'remote') {
      fullMediaStatus = 'downloading'
    }
  }
  
  const status: MediaCacheStatus = {
    itemId,
    thumbnail: thumbnailStatus,
    fullMedia: fullMediaStatus,
    lastChecked: now
  }
  
  // Update store
  cacheStatusStore.update(map => {
    map.set(itemId, status)
    return map
  })
  
  return status
}

/**
 * Get cache status for a media item (from store if available)
 */
export function getMediaCacheStatus(itemId: string): MediaCacheStatus | null {
  let status: MediaCacheStatus | null = null
  cacheStatusStore.update(map => {
    status = map.get(itemId) || null
    return map
  })
  return status
}

/**
 * Mark item as downloading
 */
export function markAsDownloading(itemId: string): void {
  downloadingItems.update(set => {
    set.add(itemId)
    return set
  })
  
  // Update cache status
  cacheStatusStore.update(map => {
    const existing = map.get(itemId)
    if (existing) {
      map.set(itemId, {
        ...existing,
        fullMedia: 'downloading',
        lastChecked: Date.now()
      })
    }
    return map
  })
}

/**
 * Mark item as downloaded (cached)
 */
export function markAsCached(itemId: string, type: 'thumbnail' | 'full'): void {
  downloadingItems.update(set => {
    set.delete(itemId)
    return set
  })
  
  // Update cache status
  cacheStatusStore.update(map => {
    const existing = map.get(itemId) || {
      itemId,
      thumbnail: 'unknown',
      fullMedia: 'unknown',
      lastChecked: Date.now()
    }
    
    map.set(itemId, {
      ...existing,
      [type === 'thumbnail' ? 'thumbnail' : 'fullMedia']: 'cached',
      lastChecked: Date.now()
    })
    
    return map
  })
}

/**
 * Clear cache status for an item
 */
export function clearCacheStatus(itemId: string): void {
  cacheStatusStore.update(map => {
    map.delete(itemId)
    return map
  })
  
  downloadingItems.update(set => {
    set.delete(itemId)
    return set
  })
}

/**
 * Batch check cache status for multiple items
 */
export async function batchCheckCacheStatus(items: MediaItem[]): Promise<MediaCacheStatus[]> {
  const results = await Promise.allSettled(
    items.map(item => checkMediaCacheStatus(item))
  )
  
  const statuses: MediaCacheStatus[] = []
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      statuses.push(result.value)
    }
  })
  
  return statuses
}

/**
 * Get derived store for a specific item's cache status
 */
export function getItemCacheStatusStore(itemId: string) {
  return derived(cacheStatusStore, $map => $map.get(itemId) || null)
}

/**
 * Get all cache statuses
 */
export const allCacheStatuses = derived(cacheStatusStore, $map => 
  Array.from($map.values())
)

/**
 * Get cache statistics
 */
export const cacheStats = derived(
  [cacheStatusStore, downloadingItems],
  ([$cacheStatus, $downloading]) => {
    const statuses = Array.from($cacheStatus.values())
    
    return {
      totalItems: statuses.length,
      cachedThumbnails: statuses.filter(s => s.thumbnail === 'cached').length,
      cachedFullMedia: statuses.filter(s => s.fullMedia === 'cached').length,
      downloading: $downloading.size,
      remoteOnly: statuses.filter(s => 
        s.thumbnail === 'remote' && s.fullMedia === 'remote'
      ).length
    }
  }
)