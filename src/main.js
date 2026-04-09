/**
 * Application entry point.
 * Wires all modules together and bootstraps the UI.
 *
 * This file replaces the original monolithic src-reference/main.js.
 * See kilo-dev-process.md for architectural decisions.
 */

import { Buffer } from 'buffer';
import {
  client,
  getStoredCredentials,
  reconnect,
  sendCode,
  submitCode,
  submitPassword,
  logout,
} from './auth/index.js';
import { initImageCache, getCacheStats, getCacheTotalSize, clearCache } from './cache/index.js';
import {
  getSettings,
  saveSettings,
  isMobileDevice,
  getGridOptions,
  getGridColumns,
  setGridColumns,
  DEFAULT_SETTINGS,
  cycleGridZoom,
} from './settings/index.js';
import {
  allDialogs,
  galleryIds,
  loadDialogs,
  addToGallery,
  removeFromGallery,
  renderGalleriesList,
  renderGroupsList,
  renderChatsList,
  filterGalleries,
  filterGroups,
  filterChats,
} from './dialogs/index.js';
import { loadGallery, checkAndLoadMore, currentDialog } from './gallery/index.js';
import {
  openFullscreen,
  closeFullscreen,
  navigateImage,
  downloadCurrentMedia,
} from './viewer/index.js';
import { initRouter } from './router/index.js';
import { formatBytes } from './utils/format.js';

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

window.Buffer = Buffer;

// Expose cache debug helpers to browser console
window.getCacheStats = getCacheStats;
window.clearCache = clearCache;

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const { envApiId, envApiHash, session, apiId, apiHash } = getStoredCredentials();

// Pre-fill or hide API credential inputs if set via .env
const apiIdInput = document.getElementById('api-id');
const apiHashInput = document.getElementById('api-hash');

if (envApiId && envApiHash) {
  apiIdInput.value = envApiId;
  apiHashInput.value = envApiHash;
  apiIdInput.style.display = 'none';
  apiHashInput.style.display = 'none';
} else if (apiId && apiHash) {
  apiIdInput.value = apiId;
  apiHashInput.value = apiHash;
}

if (session && apiId && apiHash) {
  reconnect(setStatus, showGalleries);
}

// ---------------------------------------------------------------------------
// Auth screen handlers
// ---------------------------------------------------------------------------

document.getElementById('send-code').addEventListener('click', () => {
  sendCode(
    document.getElementById('api-id').value,
    document.getElementById('api-hash').value,
    document.getElementById('phone').value,
    setStatus,
    () => { document.getElementById('code-input').style.display = 'block'; }
  );
});

document.getElementById('submit-code').addEventListener('click', () => {
  submitCode(
    document.getElementById('code').value,
    setStatus,
    showGalleries,
    () => { document.getElementById('password-input').style.display = 'block'; }
  );
});

document.getElementById('submit-password').addEventListener('click', () => {
  submitPassword(
    document.getElementById('password').value,
    setStatus,
    showGalleries
  );
});

document.getElementById('logout').addEventListener('click', logout);

function setStatus(message) {
  document.getElementById('auth-status').textContent = message;
}

// ---------------------------------------------------------------------------
// Main galleries screen
// ---------------------------------------------------------------------------

async function showGalleries() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('galleries-screen').style.display = 'block';

  await initImageCache();
  await loadDialogs();

  // Handle deep-link hash
  const hash = window.location.hash;
  if (hash.startsWith('#/gallery/')) {
    const galleryId = hash.split('/')[2];
    if (galleryId) {
      const dialog = allDialogs.find((d) => String(d.id) === galleryId);
      if (dialog) {
        loadGallery(dialog, true, openFullscreen);
        return;
      }
    }
  }

  const currentView = localStorage.getItem('currentView') || 'galleries';
  if (galleryIds.length === 0 && currentView === 'galleries') {
    switchView('groups');
  } else {
    switchView(currentView);
  }

  renderAllLists();
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

const tabs = {
  galleries: document.getElementById('tab-galleries'),
  groups: document.getElementById('tab-groups'),
  chats: document.getElementById('tab-chats'),
  settings: document.getElementById('tab-settings'),
};

const views = {
  galleries: document.getElementById('galleries-list-view'),
  groups: document.getElementById('groups-view'),
  chats: document.getElementById('chats-view'),
  settings: document.getElementById('settings-view'),
};

tabs.galleries.addEventListener('click', () => switchView('galleries'));
tabs.groups.addEventListener('click', () => switchView('groups'));
tabs.chats.addEventListener('click', () => switchView('chats'));
tabs.settings.addEventListener('click', () => switchView('settings'));

function switchView(view) {
  localStorage.setItem('currentView', view);

  Object.values(views).forEach((v) => (v.style.display = 'none'));
  Object.values(tabs).forEach((t) => t.classList.remove('active'));

  views[view].style.display = 'block';
  tabs[view].classList.add('active');

  if (view === 'settings') loadSettingsUI();

  updateSearchVisibility(view);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const searchInput = document.getElementById('search-input');
const searchContainer = document.getElementById('search-container');

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const view = localStorage.getItem('currentView') || 'galleries';
  if (view === 'groups') filterGroups(query);
  else if (view === 'chats') filterChats(query);
  else filterGalleries(query);
});

function updateSearchVisibility(view) {
  if (view === 'settings') {
    searchContainer.style.display = 'none';
    return;
  }

  let count = 0;
  if (view === 'galleries') count = galleryIds.length;
  else if (view === 'groups') count = allDialogs.filter((d) => d.entity.className.includes('Chat') || d.entity.className.includes('Channel')).length;
  else if (view === 'chats') count = allDialogs.filter((d) => d.entity.className === 'User' || d.isUser).length;

  searchContainer.style.display = count > 20 ? 'block' : 'none';
  searchInput.value = '';
}

// ---------------------------------------------------------------------------
// Render all dialog lists
// ---------------------------------------------------------------------------

function renderAllLists() {
  const onDialogClick = (dialog) => loadGallery(dialog, true, openFullscreen);

  renderGalleriesList(
    onDialogClick,
    (id) => { removeFromGallery(id, renderAllLists); }
  );
  renderGroupsList(
    onDialogClick,
    (id) => { addToGallery(id, renderAllLists) || removeFromGallery(id, renderAllLists); }
  );
  renderChatsList(
    onDialogClick,
    (id) => { addToGallery(id, renderAllLists) || removeFromGallery(id, renderAllLists); }
  );
}

// ---------------------------------------------------------------------------
// Gallery screen handlers
// ---------------------------------------------------------------------------

document.getElementById('back-to-galleries').addEventListener('click', () => {
  window.location.hash = '';
  document.getElementById('gallery-screen').style.display = 'none';
  document.getElementById('galleries-screen').style.display = 'block';

  if (window.thumbnailObserver) {
    window.thumbnailObserver.disconnect();
    window.thumbnailObserver = null;
  }
});

document.getElementById('remove-gallery').addEventListener('click', () => {
  if (!currentDialog) return;

  const isInGallery = galleryIds.some((id) => String(id) === String(currentDialog.id));
  if (isInGallery) {
    removeFromGallery(currentDialog.id, renderAllLists);
  } else {
    addToGallery(currentDialog.id, renderAllLists);
  }

  const nowInGallery = galleryIds.some((id) => String(id) === String(currentDialog.id));
  const btn = document.getElementById('remove-gallery');
  btn.textContent = nowInGallery ? 'Remove' : 'Add';
  btn.style.background = nowInGallery ? '#d32f2f' : '#0088cc';
});

document.getElementById('zoom-grid').addEventListener('click', cycleGridZoom);

// Scroll listener with debounce
let scrollTimeout;
document.getElementById('gallery-screen').addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => checkAndLoadMore(openFullscreen), 200);
});

// ---------------------------------------------------------------------------
// Fullscreen viewer handlers
// ---------------------------------------------------------------------------

document.getElementById('close-viewer').addEventListener('click', closeFullscreen);
document.getElementById('prev-image').addEventListener('click', () => navigateImage(-1));
document.getElementById('next-image').addEventListener('click', () => navigateImage(1));
document.getElementById('download-media').addEventListener('click', downloadCurrentMedia);

document.addEventListener('keydown', (e) => {
  if (document.getElementById('fullscreen-viewer').style.display === 'flex') {
    if (e.key === 'Escape') closeFullscreen();
    if (e.key === 'ArrowLeft') navigateImage(-1);
    if (e.key === 'ArrowRight') navigateImage(1);
  }
});

// ---------------------------------------------------------------------------
// Settings UI
// ---------------------------------------------------------------------------

function loadSettingsUI() {
  const settings = getSettings();
  const gridOptions = getGridOptions();
  const currentGridColumns = getGridColumns();

  document.getElementById('device-type-label').textContent =
    `Device: ${isMobileDevice() ? 'Mobile' : 'Desktop'}`;

  document.getElementById('cache-thumbnails').value = settings.thumbnails;
  document.getElementById('cache-fullsize').value = settings.fullImages;
  document.getElementById('cache-size-limit').value = settings.maxSizeMB;

  const gridSelect = document.getElementById('grid-columns');
  gridSelect.innerHTML = '';
  gridOptions.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = `${option}x (${option} per row)`;
    if (option === currentGridColumns) opt.selected = true;
    gridSelect.appendChild(opt);
  });

  updateCacheStatsUI();
}

async function updateCacheStatsUI() {
  const statsContent = document.getElementById('cache-stats-content');
  if (!statsContent) return;

  try {
    const stats = await getCacheStats();
    const thumbSize = await getCacheTotalSize('thumbnails');
    const fullSize = await getCacheTotalSize('fullImages');
    const settings = getSettings();

    if (stats) {
      statsContent.innerHTML = `
        <div class="stat-row"><span>Thumbnails cached:</span><span>${stats.thumbnails.toLocaleString()} / ${settings.thumbnails.toLocaleString()}</span></div>
        <div class="stat-row"><span>Thumbnails size:</span><span>${formatBytes(thumbSize)}</span></div>
        <div class="stat-row"><span>Full images cached:</span><span>${stats.fullImages.toLocaleString()} / ${settings.fullImages.toLocaleString()}</span></div>
        <div class="stat-row"><span>Full images size:</span><span>${formatBytes(fullSize)} / ${settings.maxSizeMB} MB</span></div>
        <div class="stat-row"><span>Total cache size:</span><span>${formatBytes(thumbSize + fullSize)}</span></div>
      `;
    } else {
      statsContent.textContent = 'Cache not initialized';
    }
  } catch (error) {
    statsContent.textContent = 'Error loading cache stats';
    console.error('Error loading cache stats:', error);
  }
}

document.getElementById('save-settings')?.addEventListener('click', () => {
  const defaults = isMobileDevice() ? DEFAULT_SETTINGS.mobile : DEFAULT_SETTINGS.desktop;
  const gridColumns = parseInt(document.getElementById('grid-columns').value) || defaults.gridColumns;

  const settings = {
    thumbnails: parseInt(document.getElementById('cache-thumbnails').value) || 5000,
    fullImages: parseInt(document.getElementById('cache-fullsize').value) || 500,
    maxSizeMB: parseInt(document.getElementById('cache-size-limit').value) || 500,
    gridColumns,
  };

  saveSettings(settings);
  setGridColumns(gridColumns);
  alert('Settings saved!');
  updateCacheStatsUI();
});

document.getElementById('clear-cache-btn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all cached images? This cannot be undone.')) {
    await clearCache();
    alert('Cache cleared!');
    updateCacheStatsUI();
  }
});

document.getElementById('apply-mobile-defaults')?.addEventListener('click', () => {
  document.getElementById('cache-thumbnails').value = DEFAULT_SETTINGS.mobile.thumbnails;
  document.getElementById('cache-fullsize').value = DEFAULT_SETTINGS.mobile.fullImages;
  document.getElementById('cache-size-limit').value = DEFAULT_SETTINGS.mobile.maxSizeMB;
  document.getElementById('grid-columns').value = DEFAULT_SETTINGS.mobile.gridColumns;
});

document.getElementById('apply-desktop-defaults')?.addEventListener('click', () => {
  document.getElementById('cache-thumbnails').value = DEFAULT_SETTINGS.desktop.thumbnails;
  document.getElementById('cache-fullsize').value = DEFAULT_SETTINGS.desktop.fullImages;
  document.getElementById('cache-size-limit').value = DEFAULT_SETTINGS.desktop.maxSizeMB;
  document.getElementById('grid-columns').value = DEFAULT_SETTINGS.desktop.gridColumns;
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

initRouter();
