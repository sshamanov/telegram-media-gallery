import type { MediaItem } from '../../types/telegram'
import { indexMediaItem, removeFromSearchIndex, searchIndex, clearSearchIndexForDialog, clearSearchIndex, type SearchIndexItem } from '../cache/indexeddb'

/**
 * Convert a MediaItem to a SearchIndexItem for storage in the search index
 */
function mediaItemToSearchIndex(item: MediaItem): SearchIndexItem {
  return {
    mediaId: item.id,
    dialogId: item.dialogId,
    filename: item.filename,
    date: item.date,
    sender: item.sender ?? null,
    type: item.type
  }
}

/**
 * Index a media item for offline search
 */
export async function indexMediaItemForSearch(item: MediaItem): Promise<void> {
  const indexItem = mediaItemToSearchIndex(item)
  await indexMediaItem(indexItem)
}

/**
 * Remove a media item from the search index
 */
export async function removeMediaItemFromSearch(mediaId: string): Promise<void> {
  await removeFromSearchIndex(mediaId)
}

/**
 * Search for media items in the offline index
 * @param query Search query string
 * @param dialogId Optional dialog ID to filter results
 * @returns Array of SearchIndexItem matching the query
 */
export async function searchOfflineMedia(query: string, dialogId?: string): Promise<SearchIndexItem[]> {
  if (!query.trim()) {
    return []
  }
  
  return await searchIndex(query, dialogId)
}

/**
 * Clear search index for a specific dialog
 * Useful when clearing cache for a dialog or when dialog is removed
 */
export async function clearDialogSearchIndex(dialogId: string): Promise<void> {
  await clearSearchIndexForDialog(dialogId)
}

/**
 * Clear the entire search index
 * Useful when clearing all cached media
 */
export async function clearAllSearchIndex(): Promise<void> {
  await clearSearchIndex()
}

/**
 * Batch index multiple media items
 */
export async function batchIndexMediaItems(items: MediaItem[]): Promise<void> {
  // Index items sequentially to avoid overwhelming IndexedDB
  for (const item of items) {
    await indexMediaItemForSearch(item)
  }
}

/**
 * Check if offline search is available (has indexed items)
 */
export async function hasOfflineSearchData(): Promise<boolean> {
  const results = await searchIndex('')
  return results.length > 0
}