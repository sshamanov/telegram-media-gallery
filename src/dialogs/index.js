/**
 * Dialog management module.
 * Fetches, renders, filters, and bookmarks Telegram dialogs.
 * Extracted from src-reference/main.js lines 483–838.
 *
 * See kilo-dev-process.md § 5.6 for extraction notes.
 */

import { client } from '../auth/index.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {import('telegram').Dialog[]} */
export let allDialogs = [];

/** @type {string[]} */
export let galleryIds = JSON.parse(localStorage.getItem('galleryIds') || '[]');

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Fetch the first 100 dialogs from Telegram (called once after login).
 * @returns {Promise<void>}
 */
export async function loadDialogs() {
  try {
    allDialogs = await client.getDialogs({ limit: 100 });
  } catch (error) {
    console.error('Error loading dialogs:', error);
    allDialogs = [];
  }
}

// ---------------------------------------------------------------------------
// Gallery bookmarks
// ---------------------------------------------------------------------------

/**
 * Add a dialog ID to the user's gallery list.
 * @param {string|number} id
 * @param {function(): void} onUpdate
 */
export function addToGallery(id, onUpdate) {
  if (!galleryIds.some((gid) => String(gid) === String(id))) {
    galleryIds.push(String(id));
    localStorage.setItem('galleryIds', JSON.stringify(galleryIds));
    onUpdate();
  }
}

/**
 * Remove a dialog ID from the user's gallery list.
 * @param {string|number} id
 * @param {function(): void} onUpdate
 */
export function removeFromGallery(id, onUpdate) {
  galleryIds = galleryIds.filter((gid) => String(gid) !== String(id));
  localStorage.setItem('galleryIds', JSON.stringify(galleryIds));
  onUpdate();
}

/**
 * Toggle a dialog's gallery membership.
 * @param {string|number} id
 * @param {function(): void} onUpdate
 */
export function toggleGallery(id, onUpdate) {
  if (galleryIds.some((gid) => String(gid) === String(id))) {
    removeFromGallery(id, onUpdate);
  } else {
    addToGallery(id, onUpdate);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render the My Galleries tab list.
 * @param {function(import('telegram').Dialog): void} onDialogClick
 * @param {function(string|number): void} onRemove
 */
export function renderGalleriesList(onDialogClick, onRemove) {
  const galleriesList = document.getElementById('galleries-list');
  const emptyState = document.getElementById('empty-galleries');

  if (galleryIds.length === 0) {
    galleriesList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  galleriesList.innerHTML = '';

  galleryIds.forEach((id) => {
    const dialog = allDialogs.find((d) => String(d.id) === String(id));
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
      onRemove(id);
    });

    item.appendChild(name);
    item.appendChild(info);
    item.appendChild(removeBtn);
    item.addEventListener('click', () => onDialogClick(dialog));

    galleriesList.appendChild(item);
  });
}

/**
 * Render the Groups tab list.
 * @param {function(import('telegram').Dialog): void} onDialogClick
 * @param {function(string|number): void} onToggle
 */
export function renderGroupsList(onDialogClick, onToggle) {
  const dialogsList = document.getElementById('dialogs-list');

  if (allDialogs.length === 0) {
    dialogsList.innerHTML = '<div class="loading">Loading groups...</div>';
    return;
  }

  dialogsList.innerHTML = '';

  allDialogs.forEach((dialog) => {
    const entity = dialog.entity;
    if (!entity.className.includes('Chat') && !entity.className.includes('Channel')) return;

    const isInGallery = galleryIds.some((id) => String(id) === String(dialog.id));
    const item = _buildDialogItem(dialog, isInGallery, onDialogClick, onToggle);
    dialogsList.appendChild(item);
  });
}

/**
 * Render the Chats tab list.
 * @param {function(import('telegram').Dialog): void} onDialogClick
 * @param {function(string|number): void} onToggle
 */
export function renderChatsList(onDialogClick, onToggle) {
  const chatsList = document.getElementById('chats-list');

  if (allDialogs.length === 0) {
    chatsList.innerHTML = '<div class="loading">Loading chats...</div>';
    return;
  }

  chatsList.innerHTML = '';

  allDialogs.forEach((dialog) => {
    const entity = dialog.entity;
    if (entity.className !== 'User' && !dialog.isUser) return;

    const isInGallery = galleryIds.some((id) => String(id) === String(dialog.id));
    const item = _buildDialogItem(dialog, isInGallery, onDialogClick, onToggle);
    chatsList.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// Search / filtering
// ---------------------------------------------------------------------------

/** @param {string} query */
export function filterGalleries(query) {
  document.querySelectorAll('#galleries-list .gallery-item').forEach((item) => {
    const name = item.querySelector('.gallery-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

/** @param {string} query */
export function filterGroups(query) {
  document.querySelectorAll('#dialogs-list .dialog-item').forEach((item) => {
    const name = item.querySelector('.dialog-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

/** @param {string} query */
export function filterChats(query) {
  document.querySelectorAll('#chats-list .dialog-item').forEach((item) => {
    const name = item.querySelector('.dialog-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a dialog list item DOM element.
 * @private
 */
function _buildDialogItem(dialog, isInGallery, onDialogClick, onToggle) {
  const item = document.createElement('div');
  item.className = 'dialog-item';

  const name = document.createElement('div');
  name.className = 'dialog-name';
  name.textContent = dialog.title || 'Unnamed';

  const info = document.createElement('div');
  info.className = 'dialog-info';
  info.textContent = dialog.entity.className;

  const btn = document.createElement('button');
  btn.className = isInGallery ? 'delete-btn' : 'add-btn';
  btn.textContent = isInGallery ? 'Remove' : 'Add';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onToggle(dialog.id);
  });

  item.appendChild(name);
  item.appendChild(info);
  item.appendChild(btn);
  item.addEventListener('click', () => onDialogClick(dialog));

  return item;
}
