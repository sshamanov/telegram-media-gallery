/**
 * IndexedDB image cache module.
 * Manages thumbnail and full-image blobs with LRU-style pruning.
 * Extracted from src-reference/main.js lines 117–909.
 *
 * See kilo-dev-process.md § 5.2 for extraction notes.
 *
 * Database: TelegramGalleryCache (v1)
 * Stores:   thumbnails  { id: string, blob: Blob, timestamp: number }
 *           fullImages  { id: string, blob: Blob, timestamp: number }
 * Key:      `${dialogId}_${messageId}`
 */

import { getSettings } from '../settings/index.js';
import { formatBytes } from '../utils/format.js';

/** @type {IDBDatabase | null} */
let imageDB = null;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Open (or create) the IndexedDB database.
 * Must be called before any cache operations.
 * @returns {Promise<IDBDatabase>}
 */
export async function initImageCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TelegramGalleryCache', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      imageDB = request.result;
      resolve(imageDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('thumbnails')) {
        db.createObjectStore('thumbnails', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('fullImages')) {
        db.createObjectStore('fullImages', { keyPath: 'id' });
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached image blob.
 * @param {string|number} dialogId
 * @param {number} messageId
 * @param {'thumbnail'|'full'} type
 * @returns {Promise<Blob|null>}
 */
export async function getCachedImage(dialogId, messageId, type = 'thumbnail') {
  if (!imageDB) return null;
  const storeName = type === 'thumbnail' ? 'thumbnails' : 'fullImages';
  const cacheKey = `${dialogId}_${messageId}`;

  return new Promise((resolve) => {
    const tx = imageDB.transaction([storeName], 'readonly');
    const req = tx.objectStore(storeName).get(cacheKey);
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Store an image blob in the cache.
 * Triggers pruning after write.
 * @param {string|number} dialogId
 * @param {number} messageId
 * @param {Blob} blob
 * @param {'thumbnail'|'full'} type
 * @returns {Promise<void>}
 */
export async function cacheImage(dialogId, messageId, blob, type = 'thumbnail') {
  if (!imageDB) return;
  const storeName = type === 'thumbnail' ? 'thumbnails' : 'fullImages';
  const cacheKey = `${dialogId}_${messageId}`;

  return new Promise((resolve) => {
    const tx = imageDB.transaction([storeName], 'readwrite');
    const req = tx.objectStore(storeName).put({ id: cacheKey, blob, timestamp: Date.now() });
    req.onsuccess = () => {
      pruneCache(storeName);
      resolve();
    };
    req.onerror = () => resolve(); // Fail silently
  });
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/**
 * Remove oldest cache entries when count or size limits are exceeded.
 * @param {'thumbnails'|'fullImages'} storeName
 */
export async function pruneCache(storeName) {
  if (!imageDB) return;

  try {
    const settings = getSettings();
    const limits = {
      thumbnails: settings.thumbnails,
      fullImages: settings.fullImages,
      maxSizeBytes: settings.maxSizeMB * 1024 * 1024,
    };

    const tx = imageDB.transaction([storeName], 'readonly');
    const countRequest = tx.objectStore(storeName).count();

    countRequest.onsuccess = async () => {
      const count = countRequest.result;
      const limit = storeName === 'thumbnails' ? limits.thumbnails : limits.fullImages;
      let needsPruning = count > limit;

      if (storeName === 'fullImages') {
        const totalSize = await getCacheTotalSize('fullImages');
        if (totalSize > limits.maxSizeBytes) needsPruning = true;
      }

      if (!needsPruning) return;

      const readTx = imageDB.transaction([storeName], 'readonly');
      const getAllReq = readTx.objectStore(storeName).getAll();

      getAllReq.onsuccess = () => {
        const items = getAllReq.result.sort((a, b) => a.timestamp - b.timestamp);

        const deleteTx = imageDB.transaction([storeName], 'readwrite');
        const deleteStore = deleteTx.objectStore(storeName);

        let deletedCount = 0;
        let deletedSize = 0;
        let currentCount = count;
        let currentSize = items.reduce((sum, item) => sum + (item.blob?.size || 0), 0);

        for (const item of items) {
          const underCountLimit = currentCount <= limit;
          const underSizeLimit = storeName !== 'fullImages' || currentSize <= limits.maxSizeBytes;
          if (underCountLimit && underSizeLimit) break;

          const itemSize = item.blob?.size || 0;
          deleteStore.delete(item.id);
          deletedCount++;
          deletedSize += itemSize;
          currentCount--;
          currentSize -= itemSize;
        }

        if (deletedCount > 0) {
          console.log(`Pruned ${deletedCount} items (${formatBytes(deletedSize)}) from ${storeName} cache`);
        }
      };
    };
  } catch (error) {
    console.error('Error pruning cache:', error);
  }
}

// ---------------------------------------------------------------------------
// Statistics / Maintenance
// ---------------------------------------------------------------------------

/**
 * Get total byte size of all blobs in a store.
 * @param {'thumbnails'|'fullImages'} storeName
 * @returns {Promise<number>}
 */
export async function getCacheTotalSize(storeName) {
  if (!imageDB) return 0;

  return new Promise((resolve) => {
    const tx = imageDB.transaction([storeName], 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => {
      resolve(req.result.reduce((sum, item) => sum + (item.blob?.size || 0), 0));
    };
    req.onerror = () => resolve(0);
  });
}

/**
 * Get counts of cached items per store.
 * @returns {Promise<{thumbnails: number, fullImages: number} | null>}
 */
export async function getCacheStats() {
  if (!imageDB) return null;

  const stats = {};
  for (const storeName of ['thumbnails', 'fullImages']) {
    const tx = imageDB.transaction([storeName], 'readonly');
    const countReq = tx.objectStore(storeName).count();
    await new Promise((resolve) => {
      countReq.onsuccess = () => {
        stats[storeName] = countReq.result;
        resolve();
      };
    });
  }
  return stats;
}

/**
 * Clear all items from both cache stores.
 * @returns {Promise<void>}
 */
export async function clearCache() {
  if (!imageDB) return;
  for (const storeName of ['thumbnails', 'fullImages']) {
    const tx = imageDB.transaction([storeName], 'readwrite');
    tx.objectStore(storeName).clear();
  }
  console.log('Cache cleared');
}
