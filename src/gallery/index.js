/**
 * Gallery loader module.
 * Fetches media from a Telegram dialog, renders the thumbnail grid,
 * and handles infinite scroll / lazy-loading.
 * Extracted from src-reference/main.js lines 1034–1365.
 *
 * See kilo-dev-process.md § 5.4 for extraction notes.
 *
 * Media item type taxonomy:
 *   photo           — native Telegram photo (msg.photo)
 *   video           — native Telegram video (msg.video)
 *   document-image  — document with image/* MIME, ≤ 100 MB
 *   document-video  — document with video/* MIME, not MOV, ≤ 100 MB
 *   large-image     — document image > 100 MB
 *   large-video     — document MOV or video > 100 MB
 */

import { client } from '../auth/index.js';
import { getCachedImage, cacheImage } from '../cache/index.js';
import { applyGridColumns, getGridColumns, updateZoomButtonLabel } from '../settings/index.js';
import { formatBytes } from '../utils/format.js';

const CHUNK_SIZE = 200;
const MAX_AUTO_LOAD = 100 * 1024 * 1024; // 100 MB

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {import('telegram').Dialog | null} */
export let currentDialog = null;

/** @type {Array<{message: any, type: string}>} */
export let photos = [];

let lastOffsetId = 0;
let hasMorePhotos = true;
let isLoadingMore = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load media for a dialog and render the thumbnail grid.
 * @param {import('telegram').Dialog} dialog
 * @param {boolean} reset  — clear existing photos and reset pagination
 * @param {function(number): void} onOpenFullscreen  — called with photo index on click
 */
export async function loadGallery(dialog, reset = true, onOpenFullscreen) {
  currentDialog = dialog;

  const galleriesScreen = document.getElementById('galleries-screen');
  const galleryScreen = document.getElementById('gallery-screen');
  galleriesScreen.style.display = 'none';
  galleryScreen.style.display = 'block';

  window.location.hash = `#/gallery/${dialog.id}`;
  document.getElementById('gallery-title').textContent = dialog.title;

  applyGridColumns(getGridColumns());
  updateZoomButtonLabel();

  const grid = document.getElementById('photos-grid');

  if (reset) {
    photos = [];
    lastOffsetId = 0;
    hasMorePhotos = true;
    isLoadingMore = false;
    grid.innerHTML = '<div class="loading">Loading media...</div>';
    galleryScreen.scrollTop = 0;

    if (window.thumbnailObserver) {
      window.thumbnailObserver.disconnect();
      window.thumbnailObserver = null;
    }
  }

  if (isLoadingMore || !hasMorePhotos) return;
  isLoadingMore = true;

  const loadingDialog = dialog;

  try {
    if (reset) grid.innerHTML = '';

    const newPhotos = [];
    let batchCount = 0;
    const maxBatches = 20;

    while (newPhotos.length < CHUNK_SIZE && hasMorePhotos && batchCount < maxBatches) {
      if (currentDialog !== loadingDialog) {
        isLoadingMore = false;
        return;
      }

      const messages = await client.getMessages(dialog.entity, {
        limit: 100,
        offsetId: lastOffsetId,
      });

      batchCount++;

      if (messages.length === 0) {
        hasMorePhotos = false;
        break;
      }

      lastOffsetId = messages[messages.length - 1].id;
      if (messages.length < 100) hasMorePhotos = false;

      for (const msg of messages) {
        const item = _classifyMessage(msg);
        if (item) {
          newPhotos.push(item);
          if (newPhotos.length >= CHUNK_SIZE) break;
        }
      }
    }

    if (currentDialog !== loadingDialog) {
      isLoadingMore = false;
      return;
    }

    if (newPhotos.length === 0) {
      if (photos.length === 0) {
        grid.innerHTML = '<div class="loading">No photos or videos in this chat</div>';
      }
      isLoadingMore = false;
      return;
    }

    const startIndex = photos.length;
    photos = photos.concat(newPhotos);

    _ensureObserver(dialog);

    for (let i = 0; i < newPhotos.length; i++) {
      if (currentDialog !== loadingDialog) {
        isLoadingMore = false;
        return;
      }

      const photoItem = document.createElement('div');
      photoItem.className = 'photo-item';
      photoItem.dataset.index = startIndex + i;
      photoItem.dataset.loaded = 'false';
      photoItem.addEventListener('click', () => onOpenFullscreen(startIndex + i));

      grid.appendChild(photoItem);
      window.thumbnailObserver.observe(photoItem);
    }

    isLoadingMore = false;
    checkAndLoadMore(onOpenFullscreen);
  } catch (error) {
    console.error('Error loading photos:', error);
    isLoadingMore = false;
    if (photos.length === 0) {
      grid.innerHTML = '<div class="loading">Error loading photos</div>';
    }
  }
}

/**
 * Check scroll position and load the next chunk if needed.
 * @param {function(number): void} onOpenFullscreen
 */
export function checkAndLoadMore(onOpenFullscreen) {
  if (!currentDialog || !hasMorePhotos || isLoadingMore) return;

  const galleryScreen = document.getElementById('gallery-screen');
  const grid = document.getElementById('photos-grid');
  const photoItems = grid.querySelectorAll('.photo-item');

  if (photoItems.length === 0) return;

  const { scrollTop, scrollHeight, clientHeight } = galleryScreen;
  const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
  const estimatedIndex = Math.floor(photoItems.length * scrollPercentage);
  const remaining = photoItems.length - estimatedIndex;

  if (remaining < 100) {
    loadGallery(currentDialog, false, onOpenFullscreen);
  }
}

// ---------------------------------------------------------------------------
// Thumbnail loading
// ---------------------------------------------------------------------------

/**
 * Lazy-load the thumbnail for a photo-item element.
 * Called by IntersectionObserver when the element becomes visible.
 * @param {HTMLElement} photoItem
 * @param {import('telegram').Dialog} dialog
 * @param {{message: any, type: string}} item
 */
export async function loadThumbnail(photoItem, dialog, item) {
  photoItem.dataset.loaded = 'true';

  try {
    const messageId = item.message.id;
    const isLargeFile = item.type === 'large-image' || item.type === 'large-video';

    if (isLargeFile) {
      _renderLargeFileCard(photoItem, item);
      return;
    }

    const fileName = item.message.document?.attributes?.find((a) => a.fileName)?.fileName;

    let blob = await getCachedImage(dialog.id, messageId, 'thumbnail');

    if (!blob) {
      const thumb = await client.downloadMedia(item.message.media, { thumb: 1 });
      if (thumb) {
        blob = new Blob([thumb], { type: 'image/jpeg' });
        await cacheImage(dialog.id, messageId, blob, 'thumbnail');
      }
    }

    if (blob) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      photoItem.appendChild(img);

      if (item.type === 'video' || item.type === 'document-video') {
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        photoItem.appendChild(overlay);
      }

      if (fileName) {
        const filenameOverlay = document.createElement('div');
        filenameOverlay.className = 'filename-overlay';
        filenameOverlay.textContent = fileName;
        photoItem.appendChild(filenameOverlay);
      }
    } else if (fileName) {
      photoItem.innerHTML = '';
      photoItem.style.background = '#1a1a1a';
      const el = document.createElement('div');
      el.className = 'filename-only';
      el.textContent = fileName;
      photoItem.appendChild(el);
    }
  } catch (err) {
    console.error('Error loading thumbnail:', err);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Classify a Telegram message into a typed media item.
 * @param {any} msg
 * @returns {{message: any, type: string} | null}
 */
function _classifyMessage(msg) {
  if (msg.photo) return { message: msg, type: 'photo' };
  if (msg.video) return { message: msg, type: 'video' };

  if (msg.document) {
    const mimeType = msg.document.mimeType || '';
    const fileSize = msg.document.size || 0;
    const isMOV = mimeType === 'video/quicktime' || mimeType === 'video/mov';
    const isTooLarge = fileSize > MAX_AUTO_LOAD;

    if (mimeType.startsWith('image/')) {
      return { message: msg, type: isTooLarge ? 'large-image' : 'document-image' };
    }
    if (mimeType.startsWith('video/')) {
      return { message: msg, type: isMOV || isTooLarge ? 'large-video' : 'document-video' };
    }
  }

  return null;
}

/**
 * Initialise the IntersectionObserver for lazy thumbnail loading if not present.
 * @param {import('telegram').Dialog} dialog
 */
function _ensureObserver(dialog) {
  if (window.thumbnailObserver) return;

  window.thumbnailObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.dataset.loaded === 'false') {
          const index = parseInt(entry.target.dataset.index);
          const photoData = photos[index];
          if (photoData) {
            loadThumbnail(entry.target, dialog, photoData);
          }
          window.thumbnailObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '200px' }
  );
}

/**
 * Render a preview card for files that are too large to auto-download.
 * @param {HTMLElement} photoItem
 * @param {{message: any, type: string}} item
 */
function _renderLargeFileCard(photoItem, item) {
  const fileName =
    item.message.document?.attributes?.find((a) => a.fileName)?.fileName || 'Large file';
  const fileSize = item.message.document?.size || 0;

  photoItem.innerHTML = '';
  photoItem.style.background = '#1a1a1a';

  const card = document.createElement('div');
  card.className = 'preview-button';
  card.innerHTML = `
    <div class="preview-icon">📄</div>
    <div class="preview-filename">${fileName}</div>
    <div class="preview-filesize">${formatBytes(fileSize)}</div>
    <div class="preview-action">Click to preview</div>
  `;
  photoItem.appendChild(card);
}
