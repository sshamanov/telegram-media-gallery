/**
 * Hash-based router module.
 * Synchronises URL hash with app state on browser back/forward navigation.
 * Extracted from src-reference/main.js lines 1826–1868.
 *
 * See kilo-dev-process.md § 5.7 for extraction notes.
 *
 * URL patterns:
 *   #/gallery/:id          — open gallery for that dialog
 *   #/gallery/:id/:msgId   — open gallery + fullscreen for that message
 *   (empty)                — return to galleries list
 */

import { allDialogs } from '../dialogs/index.js';
import { photos, loadGallery, currentDialog } from '../gallery/index.js';
import { openFullscreen, closeFullscreen } from '../viewer/index.js';

/**
 * Register the popstate listener to handle browser back/forward navigation.
 * Must be called once during app initialisation.
 */
export function initRouter() {
  window.addEventListener('popstate', handlePopState);
}

/**
 * Handle a popstate (browser back/forward) event.
 */
function handlePopState() {
  const hash = window.location.hash;
  const fullscreenViewer = document.getElementById('fullscreen-viewer');
  const galleryScreen = document.getElementById('gallery-screen');
  const galleriesScreen = document.getElementById('galleries-screen');

  if (!hash || hash === '#') {
    if (fullscreenViewer.style.display === 'flex') {
      closeFullscreen();
    }
    if (galleryScreen.style.display === 'block') {
      galleryScreen.style.display = 'none';
      galleriesScreen.style.display = 'block';
      // Note: currentDialog reset is handled by the caller
    }
    return;
  }

  if (hash.startsWith('#/gallery/')) {
    const parts = hash.split('/');
    const galleryId = parts[2];
    const messageId = parts[3];

    if (!galleryId || allDialogs.length === 0) return;

    const dialog = allDialogs.find((d) => String(d.id) === galleryId);

    if (messageId && dialog && currentDialog === dialog && photos.length > 0) {
      const photoIndex = photos.findIndex((p) => String(p.message.id) === messageId);
      if (photoIndex !== -1 && fullscreenViewer.style.display !== 'flex') {
        openFullscreen(photoIndex);
      }
    } else if (dialog && currentDialog !== dialog) {
      if (fullscreenViewer.style.display === 'flex') closeFullscreen();
      loadGallery(dialog, true, openFullscreen);
    }
  }
}
