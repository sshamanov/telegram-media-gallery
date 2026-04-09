import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Buffer } from 'buffer';

// Make Buffer global
window.Buffer = Buffer;

// State
let client = null;
let currentDialog = null;
let photos = [];
let currentPhotoIndex = 0;
let lastOffsetId = 0;
let hasMorePhotos = true;
let isLoadingMore = false;
const CHUNK_SIZE = 200;
let currentLoadId = 0; // Track which load operation is current

// Settings defaults
const DEFAULT_SETTINGS = {
  desktop: {
    thumbnails: 5000,
    fullImages: 500,
    maxSizeMB: 500,
    gridColumns: 8,
    gridOptions: [4, 8, 16]
  },
  mobile: {
    thumbnails: 1000,
    fullImages: 100,
    maxSizeMB: 200,
    gridColumns: 2,
    gridOptions: [1, 2, 4]
  }
};

// Detect if mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
}

// Get current settings from localStorage or defaults
function getSettings() {
  const saved = localStorage.getItem('cacheSettings');
  const defaults = isMobileDevice() ? DEFAULT_SETTINGS.mobile : DEFAULT_SETTINGS.desktop;
  if (saved) {
    const parsed = JSON.parse(saved);
    // Merge with defaults to ensure new settings exist
    return { ...defaults, ...parsed };
  }
  return { ...defaults };
}

// Get grid options based on device
function getGridOptions() {
  return isMobileDevice() ? DEFAULT_SETTINGS.mobile.gridOptions : DEFAULT_SETTINGS.desktop.gridOptions;
}

// Get/set current grid columns
function getGridColumns() {
  const saved = localStorage.getItem('gridColumns');
  if (saved) {
    return parseInt(saved);
  }
  const settings = getSettings();
  return settings.gridColumns;
}

function setGridColumns(columns) {
  localStorage.setItem('gridColumns', columns.toString());
  applyGridColumns(columns);
}

function applyGridColumns(columns) {
  const grid = document.getElementById('photos-grid');
  if (grid) {
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  }
}

// Cycle through grid options
function cycleGridZoom() {
  const options = getGridOptions();
  const current = getGridColumns();
  const currentIndex = options.indexOf(current);
  const nextIndex = (currentIndex + 1) % options.length;
  const nextColumns = options[nextIndex];
  setGridColumns(nextColumns);
  updateZoomButtonLabel();
}

function updateZoomButtonLabel() {
  const btn = document.getElementById('zoom-grid');
  if (btn) {
    const columns = getGridColumns();
    btn.textContent = `${columns}x`;
  }
}

// Save settings to localStorage
function saveSettings(settings) {
  localStorage.setItem('cacheSettings', JSON.stringify(settings));
}

// Elements
const authScreen = document.getElementById('auth-screen');
const galleriesScreen = document.getElementById('galleries-screen');
const galleryScreen = document.getElementById('gallery-screen');
const fullscreenViewer = document.getElementById('fullscreen-viewer');

// Persistent galleries - just store IDs
let galleryIds = JSON.parse(localStorage.getItem('galleryIds') || '[]');
let currentView = localStorage.getItem('currentView') || 'galleries';
let allDialogs = [];

// IndexedDB for image cache
let imageDB = null;

// Initialize IndexedDB
async function initImageCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TelegramGalleryCache', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      imageDB = request.result;
      resolve(imageDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store for thumbnails
      if (!db.objectStoreNames.contains('thumbnails')) {
        db.createObjectStore('thumbnails', { keyPath: 'id' });
      }

      // Store for full images
      if (!db.objectStoreNames.contains('fullImages')) {
        db.createObjectStore('fullImages', { keyPath: 'id' });
      }
    };
  });
}

// Cache helpers
async function getCachedImage(dialogId, messageId, type = 'thumbnail') {
  if (!imageDB) return null;

  return new Promise((resolve, reject) => {
    const storeName = type === 'thumbnail' ? 'thumbnails' : 'fullImages';
    const transaction = imageDB.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const cacheKey = `${dialogId}_${messageId}`;
    const request = store.get(cacheKey);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

async function cacheImage(dialogId, messageId, blob, type = 'thumbnail') {
  if (!imageDB) return;

  return new Promise((resolve, reject) => {
    const storeName = type === 'thumbnail' ? 'thumbnails' : 'fullImages';
    const transaction = imageDB.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const cacheKey = `${dialogId}_${messageId}`;
    const request = store.put({
      id: cacheKey,
      blob: blob,
      timestamp: Date.now()
    });

    request.onsuccess = () => {
      // Prune cache after adding new item
      pruneCache(storeName);
      resolve();
    };
    request.onerror = () => resolve(); // Fail silently
  });
}

// Cache pruning - keep cache under control based on settings
function getCacheLimits() {
  const settings = getSettings();
  return {
    thumbnails: settings.thumbnails,
    fullImages: settings.fullImages,
    maxSizeBytes: settings.maxSizeMB * 1024 * 1024
  };
}

async function pruneCache(storeName) {
  if (!imageDB) return;

  try {
    const limits = getCacheLimits();
    const transaction = imageDB.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const countRequest = store.count();

    countRequest.onsuccess = async () => {
      const count = countRequest.result;
      const limit = storeName === 'thumbnails' ? limits.thumbnails : limits.fullImages;

      let needsPruning = count > limit;

      // For fullImages, also check total size
      if (storeName === 'fullImages') {
        const sizeCheck = await getCacheTotalSize('fullImages');
        if (sizeCheck > limits.maxSizeBytes) {
          needsPruning = true;
        }
      }

      if (needsPruning) {
        // Get all items sorted by timestamp
        const readTransaction = imageDB.transaction([storeName], 'readonly');
        const readStore = readTransaction.objectStore(storeName);
        const getAllRequest = readStore.getAll();

        getAllRequest.onsuccess = () => {
          const items = getAllRequest.result;
          // Sort by timestamp (oldest first)
          items.sort((a, b) => a.timestamp - b.timestamp);

          const deleteTransaction = imageDB.transaction([storeName], 'readwrite');
          const deleteStore = deleteTransaction.objectStore(storeName);

          let deletedCount = 0;
          let deletedSize = 0;
          let currentCount = count;
          let currentSize = items.reduce((sum, item) => sum + (item.blob?.size || 0), 0);

          for (let i = 0; i < items.length; i++) {
            // Stop if we're under both limits
            const underCountLimit = currentCount <= limit;
            const underSizeLimit = storeName !== 'fullImages' || currentSize <= limits.maxSizeBytes;

            if (underCountLimit && underSizeLimit) break;

            const itemSize = items[i].blob?.size || 0;
            deleteStore.delete(items[i].id);
            deletedCount++;
            deletedSize += itemSize;
            currentCount--;
            currentSize -= itemSize;
          }

          if (deletedCount > 0) {
            console.log(`Pruned ${deletedCount} items (${formatBytes(deletedSize)}) from ${storeName} cache`);
          }
        };
      }
    };
  } catch (error) {
    console.error('Error pruning cache:', error);
  }
}

// Get total size of a cache store
async function getCacheTotalSize(storeName) {
  if (!imageDB) return 0;

  return new Promise((resolve) => {
    const transaction = imageDB.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      const items = getAllRequest.result;
      const totalSize = items.reduce((sum, item) => sum + (item.blob?.size || 0), 0);
      resolve(totalSize);
    };

    getAllRequest.onerror = () => resolve(0);
  });
}

// Environment variables (from .env file)
const ENV_API_ID = import.meta.env.VITE_TELEGRAM_API_ID || '';
const ENV_API_HASH = import.meta.env.VITE_TELEGRAM_API_HASH || '';

// Check saved session
const savedSession = localStorage.getItem('session');
const savedApiId = localStorage.getItem('apiId') || ENV_API_ID;
const savedApiHash = localStorage.getItem('apiHash') || ENV_API_HASH;

// Pre-fill and hide API credentials if set via env
const apiIdInput = document.getElementById('api-id');
const apiHashInput = document.getElementById('api-hash');

if (ENV_API_ID && ENV_API_HASH) {
  // Hide the fields completely when set via .env
  apiIdInput.value = ENV_API_ID;
  apiHashInput.value = ENV_API_HASH;
  apiIdInput.style.display = 'none';
  apiHashInput.style.display = 'none';
} else if (savedApiId && savedApiHash) {
  // Pre-fill from localStorage if available
  apiIdInput.value = savedApiId;
  apiHashInput.value = savedApiHash;
}

if (savedSession && savedApiId && savedApiHash) {
  reconnect();
}

async function reconnect() {
  try {
    setStatus('Reconnecting...');

    const stringSession = new StringSession(savedSession);
    client = new TelegramClient(stringSession, parseInt(savedApiId), savedApiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    if (await client.isUserAuthorized()) {
      setStatus('Connected!');
      showGalleries();
    } else {
      setStatus('Please login');
    }
  } catch (error) {
    console.error('Reconnect failed:', error);
    setStatus('Please login');
    localStorage.removeItem('session');
  }
}

// Auth handlers
document.getElementById('send-code').addEventListener('click', sendCode);
document.getElementById('submit-code').addEventListener('click', submitCode);
document.getElementById('submit-password').addEventListener('click', submitPassword);
document.getElementById('logout').addEventListener('click', logout);

let phoneCodeHash = '';

async function sendCode() {
  const apiId = document.getElementById('api-id').value;
  const apiHash = document.getElementById('api-hash').value;
  const phone = document.getElementById('phone').value;

  if (!apiId || !apiHash || !phone) {
    setStatus('Please fill all fields');
    return;
  }

  try {
    setStatus('Connecting...');

    localStorage.setItem('apiId', apiId);
    localStorage.setItem('apiHash', apiHash);
    localStorage.setItem('phone', phone);

    const stringSession = new StringSession('');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const result = await client.invoke(
      new (await import('telegram/tl/api.js')).Api.auth.SendCode({
        phoneNumber: phone,
        apiId: parseInt(apiId),
        apiHash: apiHash,
        settings: new (await import('telegram/tl/api.js')).Api.CodeSettings({}),
      })
    );

    phoneCodeHash = result.phoneCodeHash;
    setStatus('Code sent! Check your Telegram');
    document.getElementById('code-input').style.display = 'block';
  } catch (error) {
    setStatus('Error: ' + error.message);
    console.error(error);
  }
}

async function submitCode() {
  const phone = localStorage.getItem('phone');
  const code = document.getElementById('code').value;

  if (!code) {
    setStatus('Please enter code');
    return;
  }

  try {
    setStatus('Verifying code...');

    const Api = (await import('telegram/tl/api.js')).Api;

    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash: phoneCodeHash,
        phoneCode: code,
      })
    );

    if (result.className === 'auth.Authorization') {
      const session = client.session.save();
      localStorage.setItem('session', session);
      setStatus('Connected!');
      showGalleries();
    }
  } catch (error) {
    if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
      setStatus('2FA required');
      document.getElementById('password-input').style.display = 'block';
    } else {
      setStatus('Error: ' + error.message);
      console.error(error);
    }
  }
}

async function submitPassword() {
  const password = document.getElementById('password').value;

  if (!password) {
    setStatus('Please enter password');
    return;
  }

  try {
    setStatus('Verifying password...');

    const Api = (await import('telegram/tl/api.js')).Api;

    const passwordInfo = await client.invoke(new Api.account.GetPassword());

    const { computeCheck } = await import('telegram/Password.js');
    const passwordCheck = await computeCheck(passwordInfo, password);

    const result = await client.invoke(
      new Api.auth.CheckPassword({
        password: passwordCheck,
      })
    );

    if (result.className === 'auth.Authorization') {
      const session = client.session.save();
      localStorage.setItem('session', session);
      setStatus('Connected!');
      showGalleries();
    }
  } catch (error) {
    setStatus('Error: ' + error.message);
    console.error(error);
  }
}

async function logout() {
  try {
    if (client) {
      await client.invoke(new (await import('telegram/tl/api.js')).Api.auth.LogOut());
    }
  } catch (error) {
    console.error(error);
  }
  localStorage.clear();
  location.reload();
}

function setStatus(message) {
  document.getElementById('auth-status').textContent = message;
}

// Main Galleries Screen
async function showGalleries() {
  authScreen.style.display = 'none';
  galleriesScreen.style.display = 'block';

  // Initialize image cache
  await initImageCache();

  // Load dialogs first
  await loadDialogs();

  // Check if there's a gallery ID in the URL
  const hash = window.location.hash;
  if (hash.startsWith('#/gallery/')) {
    const galleryId = hash.split('/')[2];
    if (galleryId) {
      // Find and open the gallery
      const dialog = allDialogs.find(d => String(d.id) === galleryId);
      if (dialog) {
        console.log('Opening gallery from URL:', dialog.title);
        loadGallery(dialog);
        return;
      }
    }
  }

  // Restore last view or default based on galleries
  if (galleryIds.length === 0 && currentView === 'galleries') {
    switchView('groups');
  } else {
    switchView(currentView);
  }

  renderBothLists();
}

// Tab switching
const galleriesTab = document.getElementById('tab-galleries');
const groupsTab = document.getElementById('tab-groups');
const chatsTab = document.getElementById('tab-chats');
const settingsTab = document.getElementById('tab-settings');
const searchInput = document.getElementById('search-input');
const searchContainer = document.getElementById('search-container');

galleriesTab.addEventListener('click', () => switchView('galleries'));
groupsTab.addEventListener('click', () => switchView('groups'));
chatsTab.addEventListener('click', () => switchView('chats'));
settingsTab.addEventListener('click', () => switchView('settings'));

function switchView(view) {
  const galleriesView = document.getElementById('galleries-list-view');
  const groupsView = document.getElementById('groups-view');
  const chatsView = document.getElementById('chats-view');
  const settingsView = document.getElementById('settings-view');

  currentView = view;
  localStorage.setItem('currentView', view);

  // Hide all views
  galleriesView.style.display = 'none';
  groupsView.style.display = 'none';
  chatsView.style.display = 'none';
  settingsView.style.display = 'none';

  // Remove active from all tabs
  galleriesTab.classList.remove('active');
  groupsTab.classList.remove('active');
  chatsTab.classList.remove('active');
  settingsTab.classList.remove('active');

  // Show selected view
  if (view === 'galleries') {
    galleriesTab.classList.add('active');
    galleriesView.style.display = 'block';
  } else if (view === 'groups') {
    groupsTab.classList.add('active');
    groupsView.style.display = 'block';
  } else if (view === 'chats') {
    chatsTab.classList.add('active');
    chatsView.style.display = 'block';
  } else if (view === 'settings') {
    settingsTab.classList.add('active');
    settingsView.style.display = 'block';
    loadSettingsUI();
  }

  updateSearchVisibility();
}

// Search functionality
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();

  if (currentView === 'groups') {
    filterGroups(query);
  } else if (currentView === 'chats') {
    filterChats(query);
  } else {
    filterGalleries(query);
  }
});

function filterGalleries(query) {
  const items = document.querySelectorAll('#galleries-list .gallery-item');
  items.forEach(item => {
    const name = item.querySelector('.gallery-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

function filterGroups(query) {
  const items = document.querySelectorAll('#dialogs-list .dialog-item');
  items.forEach(item => {
    const name = item.querySelector('.dialog-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

function filterChats(query) {
  const items = document.querySelectorAll('#chats-list .dialog-item');
  items.forEach(item => {
    const name = item.querySelector('.dialog-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

function updateSearchVisibility() {
  // Hide search on settings tab
  if (currentView === 'settings') {
    searchContainer.style.display = 'none';
    return;
  }

  let itemCount = 0;

  if (currentView === 'galleries') {
    itemCount = galleryIds.length;
  } else if (currentView === 'groups') {
    itemCount = allDialogs.filter(d => d.entity.className.includes('Chat') || d.entity.className.includes('Channel')).length;
  } else if (currentView === 'chats') {
    itemCount = allDialogs.filter(d => d.entity.className === 'User' || d.isUser).length;
  }

  searchContainer.style.display = itemCount > 20 ? 'block' : 'none';
  searchInput.value = '';
}

// Load all dialogs once
async function loadDialogs() {
  try {
    allDialogs = await client.getDialogs({ limit: 100 });
  } catch (error) {
    console.error('Error loading dialogs:', error);
    allDialogs = [];
  }
}

// Render all lists
function renderBothLists() {
  renderGalleriesList();
  renderGroupsList();
  renderChatsList();
}

// Render My Galleries list
function renderGalleriesList() {
  const galleriesList = document.getElementById('galleries-list');
  const emptyState = document.getElementById('empty-galleries');

  if (galleryIds.length === 0) {
    galleriesList.innerHTML = '';
    emptyState.style.display = 'block';
    updateSearchVisibility();
    return;
  }

  emptyState.style.display = 'none';
  galleriesList.innerHTML = '';

  // Show only dialogs that are in galleries
  galleryIds.forEach(id => {
    const dialog = allDialogs.find(d => String(d.id) === String(id));
    if (!dialog) return;

    const item = document.createElement('div');
    item.className = 'gallery-item';

    const name = document.createElement('div');
    name.className = 'gallery-name';
    name.textContent = dialog.title || 'Unnamed';

    const info = document.createElement('div');
    info.className = 'gallery-info';
    info.textContent = dialog.entity.className;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromGallery(id);
    });

    item.appendChild(name);
    item.appendChild(info);
    item.appendChild(removeBtn);

    item.addEventListener('click', () => {
      console.log('Gallery clicked:', dialog.title);
      loadGallery(dialog);
    });

    galleriesList.appendChild(item);
  });

  updateSearchVisibility();
}

// Render Groups list
function renderGroupsList() {
  const dialogsList = document.getElementById('dialogs-list');

  if (allDialogs.length === 0) {
    dialogsList.innerHTML = '<div class="loading">Loading groups...</div>';
    return;
  }

  console.log('Rendering groups list. Current gallery IDs:', galleryIds);
  dialogsList.innerHTML = '';

  allDialogs.forEach(dialog => {
    const entity = dialog.entity;

    // Only show groups and channels
    if (!entity.className.includes('Chat') && !entity.className.includes('Channel')) {
      return;
    }

    const item = document.createElement('div');
    item.className = 'dialog-item';

    const isInGallery = galleryIds.some(id => String(id) === String(dialog.id));

    const name = document.createElement('div');
    name.className = 'dialog-name';
    name.textContent = dialog.title || 'Unnamed';

    const info = document.createElement('div');
    info.className = 'dialog-info';
    info.textContent = entity.className;

    const btn = document.createElement('button');
    btn.className = isInGallery ? 'delete-btn' : 'add-btn';
    btn.textContent = isInGallery ? 'Remove' : 'Add';

    console.log(`Group "${dialog.title}": isInGallery=${isInGallery}, className="${btn.className}", text="${btn.textContent}"`);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isInGallery) {
        removeFromGallery(dialog.id);
      } else {
        addToGallery(dialog.id);
      }
    });

    item.appendChild(name);
    item.appendChild(info);
    item.appendChild(btn);

    item.addEventListener('click', () => {
      console.log('Group clicked:', dialog.title);
      loadGallery(dialog);
    });

    dialogsList.appendChild(item);
  });

  updateSearchVisibility();
}

// Render Chats list (including Saved Messages)
function renderChatsList() {
  const chatsList = document.getElementById('chats-list');

  if (allDialogs.length === 0) {
    chatsList.innerHTML = '<div class="loading">Loading chats...</div>';
    return;
  }

  chatsList.innerHTML = '';

  allDialogs.forEach(dialog => {
    const entity = dialog.entity;

    // Only show user chats (including Saved Messages)
    if (entity.className !== 'User' && !dialog.isUser) {
      return;
    }

    const item = document.createElement('div');
    item.className = 'dialog-item';

    const isInGallery = galleryIds.some(id => String(id) === String(dialog.id));

    const name = document.createElement('div');
    name.className = 'dialog-name';
    name.textContent = dialog.title || 'Unnamed';

    const info = document.createElement('div');
    info.className = 'dialog-info';
    info.textContent = entity.className;

    const btn = document.createElement('button');
    btn.className = isInGallery ? 'delete-btn' : 'add-btn';
    btn.textContent = isInGallery ? 'Remove' : 'Add';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isInGallery) {
        removeFromGallery(dialog.id);
      } else {
        addToGallery(dialog.id);
      }
    });

    item.appendChild(name);
    item.appendChild(info);
    item.appendChild(btn);

    item.addEventListener('click', () => {
      console.log('Chat clicked:', dialog.title);
      loadGallery(dialog);
    });

    chatsList.appendChild(item);
  });

  updateSearchVisibility();
}

// Add to gallery
function addToGallery(id) {
  if (!galleryIds.some(gid => String(gid) === String(id))) {
    galleryIds.push(String(id));
    localStorage.setItem('galleryIds', JSON.stringify(galleryIds));
    renderBothLists();
  }
}

// Remove from gallery
function removeFromGallery(id) {
  galleryIds = galleryIds.filter(gid => String(gid) !== String(id));
  localStorage.setItem('galleryIds', JSON.stringify(galleryIds));
  renderBothLists();
}

// Add/Remove gallery button in gallery view
document.getElementById('remove-gallery').addEventListener('click', () => {
  if (currentDialog) {
    const isInGallery = galleryIds.some(id => String(id) === String(currentDialog.id));

    if (isInGallery) {
      removeFromGallery(currentDialog.id);
    } else {
      addToGallery(currentDialog.id);
    }

    // Update button state
    const actionBtn = document.getElementById('remove-gallery');
    const nowInGallery = galleryIds.some(id => String(id) === String(currentDialog.id));
    actionBtn.textContent = nowInGallery ? 'Remove' : 'Add';
    actionBtn.style.background = nowInGallery ? '#d32f2f' : '#0088cc';
  }
});

// Zoom grid button
document.getElementById('zoom-grid').addEventListener('click', cycleGridZoom);

// Back to galleries
document.getElementById('back-to-galleries').addEventListener('click', () => {
  // Clear URL hash
  window.location.hash = '';

  galleryScreen.style.display = 'none';
  galleriesScreen.style.display = 'block';
  currentDialog = null;

  // Disconnect observer
  if (window.thumbnailObserver) {
    window.thumbnailObserver.disconnect();
    window.thumbnailObserver = null;
  }
});

// Get cache statistics (for debugging)
async function getCacheStats() {
  if (!imageDB) return null;

  const stats = {};
  for (const storeName of ['thumbnails', 'fullImages']) {
    const transaction = imageDB.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const countRequest = store.count();

    await new Promise((resolve) => {
      countRequest.onsuccess = () => {
        stats[storeName] = countRequest.result;
        resolve();
      };
    });
  }

  return stats;
}

// Clear cache (for debugging)
async function clearCache() {
  if (!imageDB) return;

  for (const storeName of ['thumbnails', 'fullImages']) {
    const transaction = imageDB.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
  }
  console.log('Cache cleared');
}

// Make available for console debugging
window.getCacheStats = getCacheStats;
window.clearCache = clearCache;

// Settings UI
function loadSettingsUI() {
  const settings = getSettings();
  const gridOptions = getGridOptions();
  const currentGridColumns = getGridColumns();

  // Update device type label
  const deviceLabel = document.getElementById('device-type-label');
  deviceLabel.textContent = `Device: ${isMobileDevice() ? 'Mobile' : 'Desktop'}`;

  // Load current values into inputs
  document.getElementById('cache-thumbnails').value = settings.thumbnails;
  document.getElementById('cache-fullsize').value = settings.fullImages;
  document.getElementById('cache-size-limit').value = settings.maxSizeMB;

  // Populate grid columns select
  const gridSelect = document.getElementById('grid-columns');
  gridSelect.innerHTML = '';
  gridOptions.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = `${option}x (${option} per row)`;
    if (option === currentGridColumns) {
      opt.selected = true;
    }
    gridSelect.appendChild(opt);
  });

  // Update cache stats
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
        <div class="stat-row">
          <span>Thumbnails cached:</span>
          <span>${stats.thumbnails.toLocaleString()} / ${settings.thumbnails.toLocaleString()}</span>
        </div>
        <div class="stat-row">
          <span>Thumbnails size:</span>
          <span>${formatBytes(thumbSize)}</span>
        </div>
        <div class="stat-row">
          <span>Full images cached:</span>
          <span>${stats.fullImages.toLocaleString()} / ${settings.fullImages.toLocaleString()}</span>
        </div>
        <div class="stat-row">
          <span>Full images size:</span>
          <span>${formatBytes(fullSize)} / ${settings.maxSizeMB} MB</span>
        </div>
        <div class="stat-row">
          <span>Total cache size:</span>
          <span>${formatBytes(thumbSize + fullSize)}</span>
        </div>
      `;
    } else {
      statsContent.textContent = 'Cache not initialized';
    }
  } catch (error) {
    statsContent.textContent = 'Error loading cache stats';
    console.error('Error loading cache stats:', error);
  }
}

// Settings event handlers
document.getElementById('save-settings')?.addEventListener('click', () => {
  const gridColumns = parseInt(document.getElementById('grid-columns').value);
  const defaults = isMobileDevice() ? DEFAULT_SETTINGS.mobile : DEFAULT_SETTINGS.desktop;

  const settings = {
    thumbnails: parseInt(document.getElementById('cache-thumbnails').value) || 5000,
    fullImages: parseInt(document.getElementById('cache-fullsize').value) || 500,
    maxSizeMB: parseInt(document.getElementById('cache-size-limit').value) || 500,
    gridColumns: gridColumns || defaults.gridColumns
  };

  saveSettings(settings);
  setGridColumns(gridColumns || defaults.gridColumns);

  // Prune cache if needed with new settings
  pruneCache('thumbnails');
  pruneCache('fullImages');

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

// Gallery
async function loadGallery(dialog, reset = true) {
  currentDialog = dialog;
  galleriesScreen.style.display = 'none';
  galleryScreen.style.display = 'block';

  // Update URL hash
  window.location.hash = `#/gallery/${dialog.id}`;

  document.getElementById('gallery-title').textContent = dialog.title;

  // Update button based on whether this dialog is in galleries
  const isInGallery = galleryIds.some(id => String(id) === String(dialog.id));
  const actionBtn = document.getElementById('remove-gallery');
  actionBtn.textContent = isInGallery ? 'Remove' : 'Add';
  actionBtn.style.background = isInGallery ? '#d32f2f' : '#0088cc';

  const grid = document.getElementById('photos-grid');

  // Apply grid columns and update zoom button
  applyGridColumns(getGridColumns());
  updateZoomButtonLabel();

  if (reset) {
    // Clear photos array and reset pagination
    photos = [];
    lastOffsetId = 0;
    hasMorePhotos = true;
    isLoadingMore = false;
    grid.innerHTML = '<div class="loading">Loading media...</div>';
    // Scroll back to top when loading a new gallery
    galleryScreen.scrollTop = 0;

    // Disconnect observer to prevent memory leaks
    if (window.thumbnailObserver) {
      window.thumbnailObserver.disconnect();
      window.thumbnailObserver = null;
    }
  }

  if (isLoadingMore || !hasMorePhotos) {
    return;
  }

  isLoadingMore = true;

  // Store the dialog we're loading to prevent race conditions
  const loadingDialog = dialog;

  try {
    // Clear loading message on first load
    if (reset) {
      grid.innerHTML = '';
    }

    // Fetch messages until we have CHUNK_SIZE photos or run out
    const newPhotos = [];
    let batchCount = 0;
    const maxBatches = 20; // Safety limit to prevent infinite loops

    while (newPhotos.length < CHUNK_SIZE && hasMorePhotos && batchCount < maxBatches) {
      // Check if we're still viewing the same dialog
      if (currentDialog !== loadingDialog) {
        console.log('Dialog changed during loading, aborting');
        isLoadingMore = false;
        return;
      }

      const messages = await client.getMessages(dialog.entity, {
        limit: 100,
        offsetId: lastOffsetId
      });

      batchCount++;

      if (messages.length === 0) {
        hasMorePhotos = false;
        break;
      }

      // Update offset for next batch
      lastOffsetId = messages[messages.length - 1].id;

      // Check if we reached the end
      if (messages.length < 100) {
        hasMorePhotos = false;
      }

      // Extract photos, videos, and document-based media from messages
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.photo) {
          newPhotos.push({ message: msg, type: 'photo' });
          if (newPhotos.length >= CHUNK_SIZE) break;
        } else if (msg.video) {
          newPhotos.push({ message: msg, type: 'video' });
          if (newPhotos.length >= CHUNK_SIZE) break;
        } else if (msg.document) {
          // Check if document is an image or video
          const doc = msg.document;
          const mimeType = doc.mimeType || '';
          const fileSize = doc.size || 0;
          const MAX_AUTO_LOAD = 100 * 1024 * 1024; // 100MB

          // Skip MOV files and files over 100MB - show preview button instead
          const isMOV = mimeType === 'video/quicktime' || mimeType === 'video/mov';
          const isTooLarge = fileSize > MAX_AUTO_LOAD;

          if (mimeType.startsWith('image/')) {
            if (isTooLarge) {
              newPhotos.push({ message: msg, type: 'large-image' });
            } else {
              newPhotos.push({ message: msg, type: 'document-image' });
            }
            if (newPhotos.length >= CHUNK_SIZE) break;
          } else if (mimeType.startsWith('video/')) {
            if (isMOV || isTooLarge) {
              newPhotos.push({ message: msg, type: 'large-video' });
            } else {
              newPhotos.push({ message: msg, type: 'document-video' });
            }
            if (newPhotos.length >= CHUNK_SIZE) break;
          }
        }
      }
    }

    // Final check before modifying the photos array
    if (currentDialog !== loadingDialog) {
      console.log('Dialog changed after loading, discarding results');
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

    console.log(`Loaded ${newPhotos.length} items (${photos.length} total, ${batchCount} batches)`);

    // Create IntersectionObserver if not exists
    if (!window.thumbnailObserver) {
      window.thumbnailObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target;
              if (element.dataset.loaded === 'false') {
                const mediaIndex = parseInt(element.dataset.index);
                const photoData = photos[mediaIndex];
                if (photoData) {
                  loadThumbnail(element, dialog, photoData, photoData.type === 'video');
                }
                window.thumbnailObserver.unobserve(element);
              }
            }
          });
        },
        {
          rootMargin: '200px' // Start loading 200px before visible
        }
      );
    }

    // Render placeholders and lazy load thumbnails
    for (let i = 0; i < newPhotos.length; i++) {
      // Check if we're still viewing the same dialog before rendering
      if (currentDialog !== loadingDialog) {
        console.log('Dialog changed during rendering, stopping');
        isLoadingMore = false;
        return;
      }

      const item = newPhotos[i];
      const isVideo = item.type === 'video';
      const mediaIndex = startIndex + i;

      const photoItem = document.createElement('div');
      photoItem.className = 'photo-item';
      photoItem.dataset.index = mediaIndex;
      photoItem.dataset.loaded = 'false';

      // Add click handler
      photoItem.addEventListener('click', () => openFullscreen(mediaIndex));

      grid.appendChild(photoItem);
      window.thumbnailObserver.observe(photoItem);
    }

    isLoadingMore = false;

    // Check if we should load more immediately (if user scrolled while loading)
    checkAndLoadMore();
  } catch (error) {
    console.error('Error loading photos:', error);
    isLoadingMore = false;
    if (photos.length === 0) {
      grid.innerHTML = '<div class="loading">Error loading photos</div>';
    }
  }
}

// Lazy load thumbnail when item is visible
async function loadThumbnail(photoItem, dialog, item, isVideo) {
  photoItem.dataset.loaded = 'true';

  try {
    const messageId = item.message.id;
    const isLargeFile = item.type === 'large-image' || item.type === 'large-video';

    // For large files, show preview button instead of downloading
    if (isLargeFile) {
      const fileName = item.message.document?.attributes?.find(a => a.fileName)?.fileName || 'Large file';
      const fileSize = item.message.document?.size || 0;
      const fileSizeStr = formatBytes(fileSize);

      photoItem.innerHTML = '';
      photoItem.style.background = '#1a1a1a';

      const previewBtn = document.createElement('div');
      previewBtn.className = 'preview-button';
      previewBtn.innerHTML = `
        <div class="preview-icon">📄</div>
        <div class="preview-filename">${fileName}</div>
        <div class="preview-filesize">${fileSizeStr}</div>
        <div class="preview-action">Click to preview</div>
      `;
      photoItem.appendChild(previewBtn);
      return;
    }

    // Get filename for document-based media
    const fileName = item.message.document?.attributes?.find(a => a.fileName)?.fileName;

    // Check cache first
    let cachedBlob = await getCachedImage(dialog.id, messageId, 'thumbnail');

    let blob;
    if (cachedBlob) {
      blob = cachedBlob;
    } else {
      // Download if not cached
      const thumb = await client.downloadMedia(item.message.media, { thumb: 1 });
      if (thumb) {
        blob = new Blob([thumb], { type: 'image/jpeg' });
        // Cache for next time
        await cacheImage(dialog.id, messageId, blob, 'thumbnail');
      }
    }

    if (blob) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      photoItem.appendChild(img);

      // Add play button overlay for videos (including document-videos)
      if (isVideo || item.type === 'document-video') {
        const playOverlay = document.createElement('div');
        playOverlay.className = 'video-overlay';
        photoItem.appendChild(playOverlay);
      }

      // Add filename overlay for document-based media
      if (fileName) {
        const filenameOverlay = document.createElement('div');
        filenameOverlay.className = 'filename-overlay';
        filenameOverlay.textContent = fileName;
        photoItem.appendChild(filenameOverlay);
      }
    } else if (fileName) {
      // No thumbnail but we have a filename - show filename only
      photoItem.innerHTML = '';
      photoItem.style.background = '#1a1a1a';
      const filenameOnly = document.createElement('div');
      filenameOnly.className = 'filename-only';
      filenameOnly.textContent = fileName;
      photoItem.appendChild(filenameOnly);
    }
  } catch (err) {
    console.error('Error loading thumbnail:', err);
  }
}

// Scroll detection for auto-loading
function checkAndLoadMore() {
  if (!currentDialog || !hasMorePhotos || isLoadingMore) {
    return;
  }

  const grid = document.getElementById('photos-grid');
  const scrollContainer = galleryScreen;

  // Calculate how far we've scrolled
  const scrollTop = scrollContainer.scrollTop;
  const scrollHeight = scrollContainer.scrollHeight;
  const clientHeight = scrollContainer.clientHeight;

  // Calculate how many photos are below the current scroll position
  const photoItems = grid.querySelectorAll('.photo-item');
  const totalPhotos = photoItems.length;

  if (totalPhotos === 0) return;

  // Estimate which photo we're viewing based on scroll position
  const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
  const estimatedPhotoIndex = Math.floor(totalPhotos * scrollPercentage);
  const photosRemaining = totalPhotos - estimatedPhotoIndex;

  console.log(`Scroll check: ${photosRemaining} photos remaining below viewport`);

  // Load more when less than 100 photos remain
  if (photosRemaining < 100 && hasMorePhotos && !isLoadingMore) {
    console.log('Loading more photos...');
    loadGallery(currentDialog, false);
  }
}

// Add scroll listener to gallery screen
let scrollTimeout;
galleryScreen.addEventListener('scroll', () => {
  // Debounce scroll events
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(checkAndLoadMore, 200);
});

// Fullscreen viewer
document.getElementById('close-viewer').addEventListener('click', closeFullscreen);
document.getElementById('prev-image').addEventListener('click', () => navigateImage(-1));
document.getElementById('next-image').addEventListener('click', () => navigateImage(1));
document.getElementById('download-media').addEventListener('click', downloadCurrentMedia);

async function openFullscreen(index) {
  currentPhotoIndex = index;

  // Update URL with media index BEFORE showing viewer to avoid popstate issues
  const item = photos[index];
  if (item && currentDialog) {
    // Use replaceState to avoid triggering popstate
    const newUrl = `#/gallery/${currentDialog.id}/${item.message.id}`;
    history.replaceState(null, '', newUrl);
  }

  fullscreenViewer.style.display = 'flex';
  await loadFullImage();
}

function closeFullscreen() {
  // Pause video if playing
  const video = document.getElementById('fullscreen-video');
  if (video) {
    video.pause();
    video.src = '';
  }

  // Restore gallery URL (without message ID)
  if (currentDialog) {
    const galleryUrl = `#/gallery/${currentDialog.id}`;
    history.replaceState(null, '', galleryUrl);
  }

  fullscreenViewer.style.display = 'none';
}

function navigateImage(direction) {
  // Pause current video if playing
  const video = document.getElementById('fullscreen-video');
  if (video) {
    video.pause();
  }

  currentPhotoIndex += direction;
  if (currentPhotoIndex < 0) currentPhotoIndex = photos.length - 1;
  if (currentPhotoIndex >= photos.length) currentPhotoIndex = 0;

  // Update URL for new item
  const item = photos[currentPhotoIndex];
  if (item && currentDialog) {
    const newUrl = `#/gallery/${currentDialog.id}/${item.message.id}`;
    history.replaceState(null, '', newUrl);
  }

  loadFullImage();
}

// Load large file manually when user clicks button
async function loadLargeFile(item, thisLoadId) {
  const img = document.getElementById('fullscreen-img');
  const video = document.getElementById('fullscreen-video');
  const info = document.getElementById('image-info');

  const isVideo = item.type === 'large-video';
  const messageId = item.message.id;

  // Check if still current
  if (thisLoadId !== currentLoadId) return;

  info.textContent = 'Starting download...';

  try {
    // Check cache first
    let cachedBlob = await getCachedImage(currentDialog.id, messageId, 'full');

    if (thisLoadId !== currentLoadId) return;

    let blob;
    if (cachedBlob) {
      blob = cachedBlob;
      info.textContent = 'Loaded from cache ✓';
    } else {
      // Download with progress
      const totalSize = item.message.document?.size || 0;

      const buffer = await client.downloadMedia(item.message.media, {
        progressCallback: (downloaded, total) => {
          if (thisLoadId !== currentLoadId) return;

          if (total > 0) {
            const percent = Math.round((downloaded / total) * 100);
            const downloadedStr = formatBytesNoDecimal(downloaded);
            const totalStr = formatBytesNoDecimal(total);
            info.textContent = `Downloading: (${percent}%) ${downloadedStr} / ${totalStr}`;
          } else if (totalSize > 0) {
            const percent = Math.round((downloaded / totalSize) * 100);
            const downloadedStr = formatBytesNoDecimal(downloaded);
            const totalStr = formatBytesNoDecimal(totalSize);
            info.textContent = `Downloading: (${percent}%) ${downloadedStr} / ${totalStr}`;
          } else {
            info.textContent = `Downloading: ${formatBytesNoDecimal(downloaded)}`;
          }
        }
      });

      if (thisLoadId !== currentLoadId) {
        console.log('Large file download cancelled - user switched items');
        return;
      }

      const mimeType = item.message.document?.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
      blob = new Blob([buffer], { type: mimeType });

      // Cache it
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
        const resolution = `${video.videoWidth}x${video.videoHeight}`;
        const duration = formatDuration(video.duration);
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${date.toLocaleDateString()} • ${resolution} • ${duration} • ${size}`;
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
        const resolution = `${img.naturalWidth}x${img.naturalHeight}`;
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${date.toLocaleDateString()} • ${resolution} • ${size}`;
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

async function loadFullImage() {
  const item = photos[currentPhotoIndex];
  const img = document.getElementById('fullscreen-img');
  const video = document.getElementById('fullscreen-video');
  const info = document.getElementById('image-info');

  const isVideo = item.type === 'video' || item.type === 'document-video';
  const isPhoto = item.type === 'photo' || item.type === 'document-image';
  const isLargeFile = item.type === 'large-image' || item.type === 'large-video';
  const messageId = item.message.id;

  // Increment load ID to track this specific load operation
  currentLoadId++;
  const thisLoadId = currentLoadId;

  // Reset video state
  video.pause();
  video.src = '';

  // Handle large files - don't auto-download
  if (isLargeFile) {
    img.style.display = 'none';
    video.style.display = 'none';

    const fileName = item.message.document?.attributes?.find(a => a.fileName)?.fileName || 'Large file';
    const fileSize = item.message.document?.size || 0;
    const fileSizeStr = formatBytes(fileSize);

    info.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">${fileName}</div>
        <div style="font-size: 14px; margin-bottom: 15px; color: #888;">${fileSizeStr}</div>
        <button id="manual-download-btn" style="padding: 10px 20px; background: #0088cc; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Download to view
        </button>
      </div>
    `;

    // Add click handler for manual download
    document.getElementById('manual-download-btn')?.addEventListener('click', async () => {
      await loadLargeFile(item, thisLoadId);
    });

    return;
  }

  info.textContent = 'Loading...';

  try {
    // STEP 1: Always load and show thumbnail FIRST for immediate preview
    let cachedThumb = await getCachedImage(currentDialog.id, messageId, 'thumbnail');

    // Check if we're still showing the same item
    if (thisLoadId !== currentLoadId) {
      console.log('Load cancelled - user switched to different item');
      return;
    }

    // If thumbnail not cached, download it NOW before continuing
    if (!cachedThumb) {
      info.textContent = 'Loading preview...';
      try {
        const thumbBuffer = await client.downloadMedia(item.message.media, { thumb: 1 });

        // Check again after async operation
        if (thisLoadId !== currentLoadId) return;

        if (thumbBuffer) {
          cachedThumb = new Blob([thumbBuffer], { type: 'image/jpeg' });
          // Cache it in background (don't await)
          cacheImage(currentDialog.id, messageId, cachedThumb, 'thumbnail');
        }
      } catch (err) {
        console.error('Error loading thumbnail:', err);
      }
    }

    // Check again before updating UI
    if (thisLoadId !== currentLoadId) return;

    // Show thumbnail as preview (both for photos and videos)
    if (cachedThumb) {
      const thumbUrl = URL.createObjectURL(cachedThumb);
      img.src = thumbUrl;
      img.style.display = 'block';
      video.style.display = 'none';
      info.textContent = 'Loading full quality...';
    } else {
      // No thumbnail available, hide both
      img.style.display = 'none';
      video.style.display = 'none';
    }

    // STEP 2: Now load full quality image (thumbnail stays visible during download)
    let cachedBlob = await getCachedImage(currentDialog.id, messageId, 'full');

    // Check if we're still showing the same item
    if (thisLoadId !== currentLoadId) return;

    let blob;
    if (cachedBlob) {
      blob = cachedBlob;
      console.log(`Full ${isVideo ? 'video' : 'image'} ${currentPhotoIndex + 1} loaded from cache`);

      // Check before updating UI
      if (thisLoadId !== currentLoadId) return;
      info.textContent = 'Loaded from cache ✓';
    } else {
      // Get file size for progress
      let totalSize = 0;
      if (item.message.media) {
        if (item.message.media.photo) {
          const sizes = item.message.media.photo.sizes || [];
          const largestSize = sizes[sizes.length - 1];
          totalSize = largestSize?.size || 0;
        } else if (item.message.media.document) {
          totalSize = item.message.media.document.size || 0;
        }
      }

      // Download maximum quality if not cached
      console.log(`Downloading full ${isVideo ? 'video' : 'image'} ${currentPhotoIndex + 1}...`);
      const buffer = await client.downloadMedia(item.message.media, {
        progressCallback: (downloaded, total) => {
          // Only update progress if this is still the current item
          if (thisLoadId !== currentLoadId) return;

          // GramJS progressCallback receives (downloaded bytes, total bytes)
          if (total > 0) {
            const percent = Math.round((downloaded / total) * 100);
            const downloadedStr = formatBytesNoDecimal(downloaded);
            const totalStr = formatBytesNoDecimal(total);
            info.textContent = `Downloading: (${percent}%) ${downloadedStr} / ${totalStr}`;
          } else if (totalSize > 0) {
            // Fallback to estimated total if callback doesn't provide it
            const percent = Math.round((downloaded / totalSize) * 100);
            const downloadedStr = formatBytesNoDecimal(downloaded);
            const totalStr = formatBytesNoDecimal(totalSize);
            info.textContent = `Downloading: (${percent}%) ${downloadedStr} / ${totalStr}`;
          } else {
            // No size info, just show downloaded amount
            info.textContent = `Downloading: ${formatBytesNoDecimal(downloaded)}`;
          }
        }
      });

      // Check if we're still showing the same item after download completes
      if (thisLoadId !== currentLoadId) {
        console.log('Download completed but user switched to different item - discarding');
        return;
      }

      // Determine mime type based on media type
      let mimeType = 'image/jpeg';
      if (isVideo) {
        if (item.type === 'document-video' && item.message.document) {
          mimeType = item.message.document.mimeType || 'video/mp4';
        } else {
          mimeType = 'video/mp4';
        }
      } else if (item.type === 'document-image' && item.message.document) {
        mimeType = item.message.document.mimeType || 'image/jpeg';
      }

      blob = new Blob([buffer], { type: mimeType });

      // Cache for next time
      await cacheImage(currentDialog.id, messageId, blob, 'full');
      console.log(`Full ${isVideo ? 'video' : 'image'} ${currentPhotoIndex + 1} cached`);
    }

    // Final check before displaying
    if (thisLoadId !== currentLoadId) return;

    const url = URL.createObjectURL(blob);

    if (isVideo) {
      // Replace thumbnail with video player
      img.style.display = 'none';
      video.src = url;
      video.style.display = 'block';
      video.load();

      // Display video info
      video.onloadedmetadata = () => {
        // Check if still current before updating info
        if (thisLoadId !== currentLoadId) return;

        const size = formatBytes(blob.size);
        const date = new Date(item.message.date * 1000);
        const resolution = `${video.videoWidth}x${video.videoHeight}`;
        const duration = formatDuration(video.duration);
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${date.toLocaleDateString()} • ${resolution} • ${duration} • ${size}`;
      };

      // Handle load errors
      video.onerror = () => {
        if (thisLoadId !== currentLoadId) return;
        console.error('Video load error');
        info.textContent = 'Error loading video';
      };
    } else {
      // Show image (replace thumbnail if it was shown)
      const newUrl = url;
      img.src = newUrl;
      img.style.display = 'block';
      video.style.display = 'none';

      // Wait for image to load to get dimensions
      img.onload = () => {
        // Check if still current before updating info
        if (thisLoadId !== currentLoadId) return;

        const size = formatBytes(blob.size);
        const date = new Date(item.message.date * 1000);
        const resolution = `${img.naturalWidth}x${img.naturalHeight}`;
        info.textContent = `${currentPhotoIndex + 1} / ${photos.length} • ${date.toLocaleDateString()} • ${resolution} • ${size}`;
      };

      // Handle load errors
      img.onerror = () => {
        if (thisLoadId !== currentLoadId) return;
        console.error('Image load error');
        info.textContent = 'Error loading image';
      };
    }
  } catch (error) {
    info.textContent = `Error loading ${isVideo ? 'video' : 'image'}`;
    console.error(error);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatBytesNoDecimal(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Download current media
function downloadCurrentMedia() {
  const item = photos[currentPhotoIndex];
  const img = document.getElementById('fullscreen-img');
  const video = document.getElementById('fullscreen-video');

  const isVideo = item.type === 'video';
  const element = isVideo ? video : img;

  if (!element.src) {
    console.error('No media to download');
    return;
  }

  // Create download link
  const link = document.createElement('a');
  link.href = element.src;

  // Generate filename from date and type
  const date = new Date(item.message.date * 1000);
  const dateStr = date.toISOString().split('T')[0];
  const extension = isVideo ? 'mp4' : 'jpg';
  link.download = `telegram_${dateStr}_${item.message.id}.${extension}`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (fullscreenViewer.style.display === 'flex') {
    if (e.key === 'Escape') closeFullscreen();
    if (e.key === 'ArrowLeft') navigateImage(-1);
    if (e.key === 'ArrowRight') navigateImage(1);
  }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  const hash = window.location.hash;

  // If hash is empty or just #, go back to galleries list
  if (!hash || hash === '#') {
    if (fullscreenViewer.style.display === 'flex') {
      closeFullscreen();
    }
    if (galleryScreen.style.display === 'block') {
      galleryScreen.style.display = 'none';
      galleriesScreen.style.display = 'block';
      currentDialog = null;
    }
    return;
  }

  // If hash contains a gallery ID
  if (hash.startsWith('#/gallery/')) {
    const parts = hash.split('/');
    const galleryId = parts[2];
    const messageId = parts[3];

    if (galleryId && allDialogs.length > 0) {
      const dialog = allDialogs.find(d => String(d.id) === galleryId);

      // If we have a message ID, try to open fullscreen viewer
      if (messageId && dialog && currentDialog === dialog && photos.length > 0) {
        // Find the photo with this message ID
        const photoIndex = photos.findIndex(p => String(p.message.id) === messageId);
        if (photoIndex !== -1 && fullscreenViewer.style.display !== 'flex') {
          openFullscreen(photoIndex);
        }
      } else if (dialog && currentDialog !== dialog) {
        // Open the gallery if it's different
        if (fullscreenViewer.style.display === 'flex') {
          closeFullscreen();
        }
        loadGallery(dialog);
      }
    }
  }
});
