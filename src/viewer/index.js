/**
 * Fullscreen viewer module.
 * Handles lightbox display, navigation, full-quality media loading, and download.
 * Extracted from src-reference/main.js lines 1366–1824.
 *
 * See kilo-dev-process.md § 5.5 for extraction notes.
 */

import { client } from '../auth/index.js';
import { getCachedImage, cacheImage } from '../cache/index.js';
import { photos, currentDialog } from '../gallery/index.js';
import { formatBytes, formatBytesNoDecimal, formatDuration } from '../utils/format.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

export let currentPhotoIndex = 0;

/** Monotonic counter — incremented on each new load to invalidate stale ops. */
let currentLoadId = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open the fullscreen viewer at a given photo index.
 * @param {number} index
 */
export async function openFullscreen(index) {
  currentPhotoIndex = index;

  const item = photos[index];
  if (item && currentDialog) {
    history.replaceState(null, '', `#/gallery/${currentDialog.id}/${item.message.id}`);
  }

  document.getElementById('fullscreen-viewer').style.display = 'flex';
  await loadFullImage();
}

/**
 * Close the fullscreen viewer.
 */
export function closeFullscreen() {
  const video = document.getElementById('fullscreen-video');
  if (video) {
    video.pause();
    video.src = '';
  }

  if (currentDialog) {
    history.replaceState(null, '', `#/gallery/${currentDialog.id}`);
  }

  document.getElementById('fullscreen-viewer').style.display = 'none';
}

/**
 * Navigate to the next (+1) or previous (-1) media item.
 * @param {number} direction
 */
export function navigateImage(direction) {
  const video = document.getElementById('fullscreen-video');
  if (video) video.pause();

  currentPhotoIndex = (currentPhotoIndex + direction + photos.length) % photos.length;

  const item = photos[currentPhotoIndex];
  if (item && currentDialog) {
    history.replaceState(null, '', `#/gallery/${currentDialog.id}/${item.message.id}`);
  }

  loadFullImage();
}

/**
 * Download the currently displayed media item.
 */
export function downloadCurrentMedia() {
  const item = photos[currentPhotoIndex];
  const isVideo = item.type === 'video' || item.type === 'document-video';
  const element = isVideo
    ? document.getElementById('fullscreen-video')
    : document.getElementById('fullscreen-img');

  if (!element?.src) {
    console.error('No media to download');
    return;
  }

  const date = new Date(item.message.date * 1000);
  const dateStr = date.toISOString().split('T')[0];
  const extension = isVideo ? 'mp4' : 'jpg';

  const link = document.createElement('a');
  link.href = element.src;
  link.download = `telegram_${dateStr}_${item.message.id}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------------------------------------------------------------------------
// Media loading
// ---------------------------------------------------------------------------

/**
 * Load full-quality media for the current photo index.
 * Shows thumbnail first, then replaces with full quality.
 */
export async function loadFullImage() {
  const item = photos[currentPhotoIndex];
  const img = document.getElementById('fullscreen-img');
  const video = document.getElementById('fullscreen-video');
  const info = document.getElementById('image-info');

  const isVideo = item.type === 'video' || item.type === 'document-video';
  const isLargeFile = item.type === 'large-image' || item.type === 'large-video';
  const messageId = item.message.id;

  currentLoadId++;
  const thisLoadId = currentLoadId;

  video.pause();
  video.src = '';

  if (isLargeFile) {
    img.style.display = 'none';
    video.style.display = 'none';

    const fileName =
      item.message.document?.attributes?.find((a) => a.fileName)?.fileName || 'Large file';
    const fileSize = item.message.document?.size || 0;

    info.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:48px;margin-bottom:10px;">📄</div>
        <div style="font-size:16px;font-weight:bold;margin-bottom:5px;">${fileName}</div>
        <div style="font-size:14px;margin-bottom:15px;color:#888;">${formatBytes(fileSize)}</div>
        <button id="manual-download-btn" style="padding:10px 20px;background:#0088cc;border:none;color:white;border-radius:4px;cursor:pointer;font-size:14px;">
          Download to view
        </button>
      </div>
    `;

    document.getElementById('manual-download-btn')?.addEventListener('click', async () => {
      await _loadLargeFile(item, thisLoadId);
    });

    return;
  }

  info.textContent = 'Loading...';

  try {
    // Step 1: show thumbnail immediately
    let cachedThumb = await getCachedImage(currentDialog.id, messageId, 'thumbnail');
    if (thisLoadId !== currentLoadId) return;

    if (!cachedThumb) {
      info.textContent = 'Loading preview...';
      try {
        const thumbBuffer = await client.downloadMedia(item.message.media, { thumb: 1 });
        if (thisLoadId !== currentLoadId) return;
        if (thumbBuffer) {
          cachedThumb = new Blob([thumbBuffer], { type: 'image/jpeg' });
          cacheImage(currentDialog.id, messageId, cachedThumb, 'thumbnail');
        }
      } catch (err) {
        console.error('Error loading thumbnail:', err);
      }
    }

    if (thisLoadId !== currentLoadId) return;

    if (cachedThumb) {
      img.src = URL.createObjectURL(cachedThumb);
      img.style.display = 'block';
      video.style.display = 'none';
      info.textContent = 'Loading full quality...';
    } else {
      img.style.display = 'none';
      video.style.display = 'none';
    }

    // Step 2: load full quality
    let cachedBlob = await getCachedImage(currentDialog.id, messageId, 'full');
    if (thisLoadId !== currentLoadId) return;

    let blob;
    if (cachedBlob) {
      blob = cachedBlob;
      info.textContent = 'Loaded from cache ✓';
    } else {
      let totalSize = 0;
      if (item.message.media?.photo) {
        const sizes = item.message.media.photo.sizes || [];
        totalSize = sizes[sizes.length - 1]?.size || 0;
      } else if (item.message.media?.document) {
        totalSize = item.message.media.document.size || 0;
      }

      const buffer = await client.downloadMedia(item.message.media, {
        progressCallback: (downloaded, total) => {
          if (thisLoadId !== currentLoadId) return;
          const effectiveTotal = total > 0 ? total : totalSize;
          if (effectiveTotal > 0) {
            const pct = Math.round((downloaded / effectiveTotal) * 100);
            info.textContent = `Downloading: (${pct}%) ${formatBytesNoDecimal(downloaded)} / ${formatBytesNoDecimal(effectiveTotal)}`;
          } else {
            info.textContent = `Downloading: ${formatBytesNoDecimal(downloaded)}`;
          }
        },
      });

      if (thisLoadId !== currentLoadId) return;

      let mimeType = 'image/jpeg';
      if (isVideo) {
        mimeType =
          item.type === 'document-video' && item.message.document
            ? item.message.document.mimeType || 'video/mp4'
            : 'video/mp4';
      } else if (item.type === 'document-image' && item.message.document) {
        mimeType = item.message.document.mimeType || 'image/jpeg';
      }

      blob = new Blob([buffer], { type: mimeType });
      await cacheImage(currentDialog.id, messageId, blob, 'full');
    }

    if (thisLoadId !== currentLoadId) return;

    const url = URL.createObjectURL(blob);

    if (isVideo) {
      img.style.display = 'none';
      video.src = url;
      video.style.display = 'block';
      video.load();

      video.onloadedmetadata = () => {
        if (thisLoadId !== currentLoadId) return;
        const size = formatBytes(blob.size);
        const date = new Date(item.message.date * 1000);
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${date.toLocaleDateString()} • ${video.videoWidth}x${video.videoHeight} • ${formatDuration(video.duration)} • ${size}`;
      };
      video.onerror = () => {
        if (thisLoadId !== currentLoadId) return;
        info.textContent = 'Error loading video';
      };
    } else {
      img.src = url;
      img.style.display = 'block';
      video.style.display = 'none';

      img.onload = () => {
        if (thisLoadId !== currentLoadId) return;
        const size = formatBytes(blob.size);
        const date = new Date(item.message.date * 1000);
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${date.toLocaleDateString()} • ${img.naturalWidth}x${img.naturalHeight} • ${size}`;
      };
      img.onerror = () => {
        if (thisLoadId !== currentLoadId) return;
        info.textContent = 'Error loading image';
      };
    }
  } catch (error) {
    info.textContent = `Error loading ${isVideo ? 'video' : 'image'}`;
    console.error(error);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Manually download a large file when the user explicitly requests it.
 * @param {{message: any, type: string}} item
 * @param {number} thisLoadId
 */
async function _loadLargeFile(item, thisLoadId) {
  const img = document.getElementById('fullscreen-img');
  const video = document.getElementById('fullscreen-video');
  const info = document.getElementById('image-info');
  const isVideo = item.type === 'large-video';
  const messageId = item.message.id;

  if (thisLoadId !== currentLoadId) return;
  info.textContent = 'Starting download...';

  try {
    let blob = await getCachedImage(currentDialog.id, messageId, 'full');
    if (thisLoadId !== currentLoadId) return;

    if (blob) {
      info.textContent = 'Loaded from cache ✓';
    } else {
      const totalSize = item.message.document?.size || 0;
      const buffer = await client.downloadMedia(item.message.media, {
        progressCallback: (downloaded, total) => {
          if (thisLoadId !== currentLoadId) return;
          const effectiveTotal = total > 0 ? total : totalSize;
          if (effectiveTotal > 0) {
            const pct = Math.round((downloaded / effectiveTotal) * 100);
            info.textContent = `Downloading: (${pct}%) ${formatBytesNoDecimal(downloaded)} / ${formatBytesNoDecimal(effectiveTotal)}`;
          } else {
            info.textContent = `Downloading: ${formatBytesNoDecimal(downloaded)}`;
          }
        },
      });

      if (thisLoadId !== currentLoadId) return;

      const mimeType = item.message.document?.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
      blob = new Blob([buffer], { type: mimeType });
      await cacheImage(currentDialog.id, messageId, blob, 'full');
    }

    if (thisLoadId !== currentLoadId) return;

    const url = URL.createObjectURL(blob);

    if (isVideo) {
      img.style.display = 'none';
      video.src = url;
      video.style.display = 'block';
      video.load();

      video.onloadedmetadata = () => {
        if (thisLoadId !== currentLoadId) return;
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${new Date(item.message.date * 1000).toLocaleDateString()} • ${video.videoWidth}x${video.videoHeight} • ${formatDuration(video.duration)} • ${formatBytes(blob.size)}`;
      };
      video.onerror = () => {
        if (thisLoadId !== currentLoadId) return;
        info.textContent = 'Error loading video';
      };
    } else {
      img.src = url;
      img.style.display = 'block';
      video.style.display = 'none';

      img.onload = () => {
        if (thisLoadId !== currentLoadId) return;
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${new Date(item.message.date * 1000).toLocaleDateString()} • ${img.naturalWidth}x${img.naturalHeight} • ${formatBytes(blob.size)}`;
      };
      img.onerror = () => {
        if (thisLoadId !== currentLoadId) return;
        info.textContent = 'Error loading image';
      };
    }
  } catch (error) {
    if (thisLoadId !== currentLoadId) return;
    info.textContent = `Error: ${error.message}`;
    console.error(error);
  }
}
