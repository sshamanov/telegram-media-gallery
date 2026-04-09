# Kilo Development Process — Telegram Gallery

> **Purpose**: Spec-driven migration reference. All analysis of the original MVP codebase is documented here. Use this file as the authoritative guide when implementing the refactored version. The original source code lives in `src-reference/` as read-only material.

---

## 1. Project Overview

**Name**: Telegram Gallery  
**Description**: A browser-based media gallery that uses a personal Telegram account as a storage backend. Users authenticate via the Telegram MTProto API, browse their groups/channels/chats, and view photos and videos in a responsive grid with a fullscreen lightbox.  
**Stack**: Vanilla JavaScript (ES modules), HTML5, CSS3, Vite bundler, GramJS (`telegram` npm package).  
**Original branch**: `legacy-archive` — exact MVP state, unmodified.  
**Reference source**: `src-reference/` — read-only copies of all original source files.

---

## 2. File Index

| File | Size | Role |
|------|------|------|
| `index.html` | 150 lines | Single-page application shell; defines all screen HTML structures |
| `main.js` | 1868 lines | Entire application logic (monolithic) |
| `style.css` | 643 lines | All styling; dark theme, responsive grid, fullscreen viewer |
| `vite.config.js` | 14 lines | Vite + node-polyfills plugin config |
| `package.json` | 19 lines | Dependencies: `telegram`, `big-integer`, `buffer`; devDeps: `vite`, `vite-plugin-node-polyfills` |
| `.env.example` | 3 lines | Template for `VITE_TELEGRAM_API_ID` and `VITE_TELEGRAM_API_HASH` |
| `.gitignore` | 4 lines | Ignores `node_modules/`, `dist/`, `.env`, `*.log` |
| `README.md` | 37 lines | Setup & feature documentation |
| `telegram-gallery.code-workspace` | — | VS Code workspace file (not relevant to build) |

---

## 3. Architecture Analysis

### 3.1 Application Structure

The app is a **single-page application** with four distinct "screens" managed via `display` CSS toggling. There is no client-side router — navigation is handled through hash-based URLs (`#/gallery/:id`) and manual DOM manipulation.

```
#app
├── #auth-screen          — Login form (API ID/Hash, phone, code, 2FA)
├── #galleries-screen     — Main dashboard with tabs
│   ├── Tab: My Galleries
│   ├── Tab: Groups
│   ├── Tab: Chats
│   └── Tab: Settings
├── #gallery-screen       — Photo/video grid for a selected dialog
└── #fullscreen-viewer    — Lightbox for full-resolution media
```

### 3.2 State Variables (Global, `main.js`)

| Variable | Type | Purpose |
|----------|------|---------|
| `client` | `TelegramClient \| null` | Active GramJS connection |
| `currentDialog` | `Dialog \| null` | Currently open Telegram dialog |
| `photos` | `Array` | Loaded media items for current dialog |
| `currentPhotoIndex` | `number` | Index into `photos` for fullscreen viewer |
| `lastOffsetId` | `number` | Pagination cursor for message fetching |
| `hasMorePhotos` | `boolean` | Whether more messages exist beyond current offset |
| `isLoadingMore` | `boolean` | Mutex flag preventing concurrent fetches |
| `CHUNK_SIZE` | `200` | Target media items per load batch |
| `currentLoadId` | `number` | Monotonic counter to cancel stale async operations |
| `galleryIds` | `string[]` | Persisted IDs of user-bookmarked dialogs (localStorage) |
| `currentView` | `string` | Active tab name (localStorage) |
| `allDialogs` | `Dialog[]` | All dialogs fetched once on login |
| `imageDB` | `IDBDatabase \| null` | IndexedDB handle for image cache |
| `phoneCodeHash` | `string` | Auth flow state for code verification |

### 3.3 Settings System

Settings are stored in `localStorage` under `cacheSettings` (JSON) and `gridColumns` (string). Defaults differ between mobile and desktop:

```js
DEFAULT_SETTINGS = {
  desktop: { thumbnails: 5000, fullImages: 500, maxSizeMB: 500, gridColumns: 8, gridOptions: [4, 8, 16] },
  mobile:  { thumbnails: 1000, fullImages: 100,  maxSizeMB: 200, gridColumns: 2, gridOptions: [1, 2, 4] }
}
```

Device detection uses `navigator.userAgent` regex + `window.innerWidth <= 768`.

---

## 4. Functional Decomposition

### 4.1 Authentication Flow

1. **`sendCode()`** — Creates `TelegramClient` with empty `StringSession`, calls `auth.SendCode`, stores `phoneCodeHash`.
2. **`submitCode()`** — Calls `auth.SignIn` with code + hash; on success saves session string to `localStorage`; handles `SESSION_PASSWORD_NEEDED` → shows 2FA input.
3. **`submitPassword()`** — Fetches SRP password params via `account.GetPassword`, computes `computeCheck`, calls `auth.CheckPassword`.
4. **`reconnect()`** — Auto-reconnect on page load when `session` + `apiId` + `apiHash` exist in localStorage.
5. **`logout()`** — Calls `auth.LogOut`, clears localStorage, reloads.

Credentials can be pre-populated via `.env` (`VITE_TELEGRAM_API_ID`, `VITE_TELEGRAM_API_HASH`), in which case the input fields are hidden.

### 4.2 Dialog Management

- **`loadDialogs()`** — Fetches first 100 dialogs via `client.getDialogs({ limit: 100 })` once per session.
- **`renderGroupsList()`** — Filters to `className.includes('Chat') || className.includes('Channel')`.
- **`renderChatsList()`** — Filters to `entity.className === 'User' || dialog.isUser`.
- **`renderGalleriesList()`** — Renders only dialogs whose ID is in `galleryIds`.
- **`addToGallery(id)` / `removeFromGallery(id)`** — Persist to `localStorage.galleryIds` and re-render.

### 4.3 Gallery (Photo Grid)

**`loadGallery(dialog, reset=true)`** — Core function:
1. Sets `currentDialog`, shows `#gallery-screen`, updates URL hash.
2. On reset: clears `photos[]`, resets pagination state, clears grid DOM.
3. Fetches messages in batches of 100 until `CHUNK_SIZE` (200) media items collected or no more messages.
4. Race condition guard: compares `currentDialog !== loadingDialog` after every `await`.
5. For each media item, creates a `.photo-item` DOM element with `data-index` and `data-loaded="false"`.
6. Uses `IntersectionObserver` (`window.thumbnailObserver`) to lazy-load thumbnails when elements enter the viewport (200px margin).
7. Scroll listener with 200ms debounce calls `checkAndLoadMore()` — loads next chunk when fewer than 100 photos remain below viewport.

**Media type classification** (item.type values):
| Type | Source |
|------|--------|
| `photo` | `msg.photo` (native Telegram photo) |
| `video` | `msg.video` (native Telegram video) |
| `document-image` | `msg.document` with `mimeType.startsWith('image/')`, size ≤ 100MB |
| `document-video` | `msg.document` with `mimeType.startsWith('video/')`, not MOV, size ≤ 100MB |
| `large-image` | `document` image > 100MB |
| `large-video` | `document` video that is MOV format OR > 100MB |

### 4.4 Thumbnail Loading

**`loadThumbnail(photoItem, dialog, item, isVideo)`**:
1. Checks `getCachedImage()` from IndexedDB first.
2. If not cached: `client.downloadMedia(media, { thumb: 1 })` → JPEG blob → cache.
3. Creates `<img>` element with `URL.createObjectURL(blob)`.
4. For videos: appends `.video-overlay` (play button via CSS pseudo-element).
5. For documents: appends `.filename-overlay` with file name.
6. Large files (type `large-image`/`large-video`): renders a preview card with file name, size, "Click to preview" text instead of downloading.

### 4.5 Fullscreen Viewer

**`openFullscreen(index)`** → **`loadFullImage()`**:
1. Increments `currentLoadId` to invalidate any prior async operations.
2. **Step 1**: Shows thumbnail immediately (from cache or freshly downloaded).
3. **Step 2**: Downloads full-quality media with `progressCallback` updating `#image-info`.
4. For photos: `client.downloadMedia(media)` → max quality blob → `<img>`.
5. For videos: same download → `<video>` element replaces thumbnail.
6. For large files: shows file card with "Download to view" button → `loadLargeFile()`.

**Navigation**: `navigateImage(±1)` with wraparound; updates URL hash via `history.replaceState`.

**Keyboard shortcuts**: `Escape` (close), `ArrowLeft`/`ArrowRight` (navigate).

**Download**: `downloadCurrentMedia()` creates an `<a>` link with `download` attribute, filename `telegram_YYYY-MM-DD_<msgId>.jpg|mp4`.

### 4.6 IndexedDB Image Cache

**Database**: `TelegramGalleryCache` (version 1)  
**Stores**: `thumbnails` (keyPath: `id`), `fullImages` (keyPath: `id`)  
**Cache key format**: `${dialogId}_${messageId}`  
**Record schema**: `{ id: string, blob: Blob, timestamp: number }`

**`pruneCache(storeName)`** — evicts oldest entries when count or size limits are exceeded:
- Thumbnails: count-based only (`settings.thumbnails`).
- Full images: count-based (`settings.fullImages`) AND size-based (`settings.maxSizeMB * 1024²`).
- Sort by `timestamp` ascending, delete from front.

**Exposed globals** (for browser console debugging): `window.getCacheStats()`, `window.clearCache()`.

### 4.7 URL Routing (Hash-Based)

| Hash Pattern | Behaviour |
|---|---|
| `#/gallery/:id` | Opens gallery for dialog with that ID |
| `#/gallery/:id/:msgId` | Opens gallery + fullscreen for that message |
| `''` or `#` | Returns to galleries list |

`popstate` handler restores correct view on browser back/forward.

---

## 5. Reusable Components / Extractable Modules

The following logical units are good candidates for modularization in the refactored codebase:

### 5.1 `telegramAuth.js`
- `sendCode()`, `submitCode()`, `submitPassword()`, `reconnect()`, `logout()`
- Manages `TelegramClient` lifecycle and session persistence
- **Dependencies**: GramJS, localStorage

### 5.2 `imageCache.js`
- `initImageCache()`, `getCachedImage()`, `cacheImage()`, `pruneCache()`, `getCacheTotalSize()`, `getCacheStats()`, `clearCache()`
- Pure IndexedDB wrapper, no Telegram dependency
- **Dependencies**: none (browser API only)

### 5.3 `settings.js`
- `getSettings()`, `saveSettings()`, `isMobileDevice()`, `getGridOptions()`, `getGridColumns()`, `setGridColumns()`, `applyGridColumns()`, `cycleGridZoom()`
- Manages user preferences in localStorage
- **Dependencies**: none

### 5.4 `galleryLoader.js`
- `loadGallery()`, `checkAndLoadMore()`, `loadThumbnail()`
- Media fetching, pagination, lazy-loading via IntersectionObserver
- **Dependencies**: GramJS client, imageCache, settings

### 5.5 `fullscreenViewer.js`
- `openFullscreen()`, `closeFullscreen()`, `navigateImage()`, `loadFullImage()`, `loadLargeFile()`, `downloadCurrentMedia()`
- Lightbox logic
- **Dependencies**: GramJS client, imageCache

### 5.6 `dialogManager.js`
- `loadDialogs()`, `renderGalleriesList()`, `renderGroupsList()`, `renderChatsList()`, `addToGallery()`, `removeFromGallery()`, `filterGalleries()`, `filterGroups()`, `filterChats()`
- Dialog listing, filtering, gallery bookmarking
- **Dependencies**: GramJS client

### 5.7 `router.js`
- Hash-based routing, `popstate` handler
- URL ↔ app state synchronization

### 5.8 `utils.js`
- `formatBytes()`, `formatBytesNoDecimal()`, `formatDuration()`
- Pure utility functions, no dependencies

---

## 6. Core Business Logic

### 6.1 Primary User Flows

```
1. AUTHENTICATE
   Open app → enter API credentials + phone → receive SMS code → enter code
   (optional: 2FA password) → session stored → auto-reconnect on reload

2. BROWSE DIALOGS
   Authenticated → view Groups/Chats tabs → search (shown when >20 items)
   → bookmark dialogs to "My Galleries"

3. VIEW GALLERY
   Click dialog → load media in chunks of 200 (batches of 100 messages)
   → scroll down → auto-load next chunk → lazy thumbnails via IntersectionObserver

4. VIEW FULLSCREEN
   Click thumbnail → thumbnail shown immediately → full quality downloads in background
   → navigate with arrows/keyboard → download via ⬇ button

5. MANAGE CACHE
   Settings tab → configure limits → clear cache → view cache statistics
```

### 6.2 Key Design Decisions (from MVP)

- **No server**: Pure client-side, Telegram is the backend.
- **No framework**: Vanilla JS DOM manipulation throughout.
- **Session persistence**: Telegram `StringSession` serialized to localStorage.
- **Caching strategy**: IndexedDB for blobs; LRU-style pruning by timestamp.
- **Load cancellation**: `currentLoadId` monotonic counter guards against stale async callbacks.
- **Lazy loading**: `IntersectionObserver` with 200px rootMargin for thumbnails.
- **Responsive**: Mobile vs desktop settings presets; grid columns configurable.
- **Large file handling**: Files > 100MB or MOV videos shown as preview cards, not auto-downloaded.

---

## 7. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `telegram` | `^2.26.22` | GramJS — Telegram MTProto client for browser |
| `big-integer` | `^1.6.52` | Required by GramJS for large integer arithmetic |
| `buffer` | `^6.0.3` | Node.js Buffer polyfill for browser |
| `vite` | `^5.0.0` | Build tool / dev server |
| `vite-plugin-node-polyfills` | `^0.25.0` | Polyfills `Buffer`, `global`, `process` for GramJS |

---

## 8. Known Issues / Technical Debt (from MVP)

1. **Monolithic `main.js`** (1868 lines) — all logic in one file, zero separation of concerns.
2. **No error boundary** — most errors are logged to console but not surfaced to the user.
3. **Dialog limit hardcoded** to 100 — users with many dialogs will have incomplete lists.
4. **`window.thumbnailObserver` global** — observer stored on window, fragile pattern.
5. **No TypeScript** — no type safety on GramJS API responses.
6. **`console.log` debug noise** — many debug logs left in production path.
7. **URL.createObjectURL leaks** — object URLs created but never `URL.revokeObjectURL()` called.
8. **Settings saved with `alert()`** — disruptive UX, should use toast notifications.
9. **Video download** — `downloadCurrentMedia()` only works for native `msg.video`, not `document-video`.
10. **No offline handling** — no graceful degradation when Telegram connection drops mid-session.

---

## 9. Spec-Driven Refactoring Plan

### Phase 1 — Module Extraction
- Split `main.js` into modules per section 5 above.
- Maintain identical behaviour, no new features.
- Commit each module separately.

### Phase 2 — TypeScript Migration
- Add `tsconfig.json`, convert `.js` files to `.ts`.
- Define interfaces for `MediaItem`, `CacheRecord`, `AppSettings`.
- Fix URL.createObjectURL leak with proper revocation.

### Phase 3 — Component Architecture (optional)
- Evaluate introducing a lightweight reactive framework (e.g., Preact) or Web Components.
- Retain vanilla approach if complexity doesn't justify the overhead.

### Phase 4 — UX Improvements
- Replace `alert()`/`confirm()` with inline toast notifications.
- Add error display in UI for Telegram API failures.
- Infinite scroll indicator ("Loading more...") in gallery.
- Keyboard shortcut help overlay.

### Phase 5 — Performance
- Revoke object URLs after display to prevent memory leaks.
- Implement virtual scrolling for very large galleries (>1000 items).
- Consider service worker for offline cache persistence.

---

## 10. Development Workflow

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build (output to dist/)
npm run build

# Preview production build
npm run preview
```

**Environment**:  
Copy `.env.example` to `.env` and populate `VITE_TELEGRAM_API_ID` and `VITE_TELEGRAM_API_HASH` to skip credential entry in the UI.

---

*Generated by Kilo during migration from Claude Code environment — 2026-04-09*
