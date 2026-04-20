import { debugLog } from '../../debug'
import { readCachedDialogs, writeCachedDialogs } from '../../cache/indexeddb'
import type { Dialog } from '../../../types/telegram'

export interface GetDialogsOptions {
  limit?: number
  offsetDate?: number
  forceRefresh?: boolean
}

export interface CacheFirstResult {
  dialogs: Dialog[]
  fromCache: boolean
}

/**
 * Cache-first strategy for fetching dialogs with TTL.
 * 
 * @param fetchFresh - Function that returns fresh dialogs
 * @param options - GetDialogsOptions
 * @param cacheTtlMs - Cache TTL in milliseconds (default: 5 minutes)
 * @param adapterName - Adapter name for logging (e.g., 'mtcute' or 'mock')
 * @returns Promise with dialogs and cache status
 */
export async function cacheFirstGetDialogs(
  fetchFresh: () => Promise<Dialog[]>,
  options: GetDialogsOptions = {},
  _cacheTtlMs: number = 5 * 60 * 1000,
  adapterName: string = 'adapter'
): Promise<CacheFirstResult> {
  const { forceRefresh = false, limit = Infinity, offsetDate = 0 } = options

  // Helper to filter dialogs by offsetDate and limit, deduplicate
  const filterDialogs = (allDialogs: Dialog[], limit: number, offsetDate: number): Dialog[] => {
    const seen = new Set<string>()
    const filtered: Dialog[] = []
    for (const dialog of allDialogs) {
      if (dialog.lastMessageDate && dialog.lastMessageDate <= offsetDate) continue
      if (seen.has(dialog.id)) continue
      seen.add(dialog.id)
      filtered.push(dialog)
      if (filtered.length >= limit) break
    }
    return filtered
  }

  // 1. Try cache unless forceRefresh is true
  if (!forceRefresh) {
    const cached = await readCachedDialogs()
    if (cached) {
      debugLog(`${adapterName}:getDialogs returning cached data`, { count: cached.length })
      const filtered = filterDialogs(cached, limit, offsetDate)
      return { dialogs: filtered, fromCache: true }
    }
  }

  // 2. Cache miss or force refresh: fetch fresh data
  const allDialogs = await fetchFresh()

  // 3. Store all dialogs in cache (ignore errors)
  try {
    await writeCachedDialogs(allDialogs)
  } catch (error) {
    debugLog(`${adapterName}: failed to write dialog cache`, error)
  }

  // 4. Return filtered results
  const filtered = filterDialogs(allDialogs, limit, offsetDate)
  return { dialogs: filtered, fromCache: false }
}