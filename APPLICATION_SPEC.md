# Telegram Gallery - Application Specification

## Overview
Browser-based photo/video gallery using Telegram as a storage backend. Client-only Svelte 5 PWA with no server component.

## Document Authority
- `APPLICATION_SPEC.md` is the architecture and supported-behavior source of truth.
- `STATUS.md` is the execution ledger for active plans, todo states, validations, blockers, and commits.
- `AGENTS.md` defines the required execution workflow and document-maintenance rules.
- If code, spec, and status disagree, reconcile the documents before claiming a feature or flow is complete.

## Current Supported State
- Auth baseline is supported through the real app shell and the mock adapter.
- Dialog browsing baseline is supported, including Galleries / Groups / Chats tabs and conditional search.
- Settings baseline is supported as a dedicated screen with inline cache/storage actions.
- Gallery baseline and viewer baseline are implemented with Phase 1 media types (photos, videos, PDF, audio, documents).
- Phase 2 actions (multi-select, bulk download, forward, share, copy, upload queue) are implemented and available in the UI.
- Production builds now register a real service worker that precaches the app shell (`/`, `/index.html`, hashed JS/CSS assets) and clears stale shell caches on activate.
- Dialog bootstrap now persists a sanitized last-known dialog snapshot and can render that cached state while offline after a prior online sync.
- Full-media cache storage now uses OPFS when it is usable, falls back explicitly to IndexedDB when it is not, and keeps one-time IndexedDB-to-OPFS migration state resumable and visible in settings.
- Offline gallery/viewer behavior is limited to the current cache stack: already-loaded gallery items can reuse cached thumbnails in-session, offline viewer playback/rendering works only for full media already cached in OPFS or IndexedDB fallback, and uncached full media shows an explicit offline placeholder instead of a broken load.
- Thumbnail loading is bandwidth-efficient: thumbnails are only downloaded when available from Telegram (trying 's', 'm', 'x' sizes); if no thumbnail is available, the UI shows a file-type glyph instead of downloading full media.
- While offline, download, forward, and share affordances are intentionally disabled so the UI does not imply unavailable export or Telegram relay behavior.
- Background sync for uploads: uploads are queued when offline and automatically retried when connectivity returns.
- Pre-fetching for offline browsing: users can mark dialogs for offline access, with background download of all media and progress tracking.
- Enhanced cache management: UI to view cache usage and clear cached media by age or type.
- Offline search: search within cached media metadata (filename, date, sender) while offline.
- Gallery supports masonry layout toggle with auto-detection for visual content and manual override in settings.
- Desktop layout variants (wide grid, sidebar, dual pane) are available for screen widths >1024px.
- Light theme support is implemented with comprehensive CSS variable system.

## Core Architecture

### Tech Stack
- **Frontend**: Svelte 5 + TypeScript strict
- **Build Tool**: Vite
- **Telegram Client**: `@mtcute/web`
- **Media Viewer**: PhotoSwipe v5
- **Caching**: IndexedDB for thumbnails and fallback/legacy full media, OPFS for active full-media cache when usable
- **PWA**: Manifest is part of the app; broader offline/service-worker behavior remains phase-scoped

### System Boundaries
See `AGENTS.md` for the complete set of system boundary rules that govern execution environment, Docker usage, port management, and temporary file locations.

### Standard Build Patterns
```bash
# Type check / build pattern
docker run --rm --network host \
  -v "$(pwd)":/app -w /app \
  node:24-alpine <command>

# Dev server pattern
docker run --rm --network host \
  -v "$(pwd)":/app -w /app \
  node:24-alpine npm run dev -- --host --port 5173
```

## Adapter Pattern

### TelegramAdapter Contract
All Telegram API calls go through `src/lib/telegram/adapter.ts`. Feature code must not import `@mtcute/web` directly.

### Implementations
- `src/lib/telegram/mtcute.ts` - real Telegram implementation
- `src/lib/telegram/mock.ts` - mock adapter for local validation and Playwright

### Adapter Selection
- `VITE_USE_MOCK_ADAPTER=true|1|True|TRUE|false|0|False|FALSE`
- There is no UI toggle for switching mock mode.
- Programmatic switching remains available via `switchToMockAdapter(enabled)` in `src/stores/telegram.ts`.
- If no environment override is present and Telegram API credentials are absent, the app defaults to mock mode.
- `docker-compose.yml` is reserved for manual app-server usage and must not force mock mode.
- `docker-compose.test.yml` is the dedicated Playwright/agent test compose path and may force mock mode for deterministic test runs.
- `docker-compose.test.yml` also defines the production preview path used to validate offline shell bootstrap from `dist/`.
- Telegram API credentials resolve in order: user-entered values in `localStorage`, runtime `window.__APP_CONFIG__` from `/config.js`, then build-time `VITE_TELEGRAM_API_ID`/`VITE_TELEGRAM_API_HASH` (see `src/lib/config.ts`).
- `scripts/serve-dist.mjs` serves `/config.js` from the `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` environment variables; the production image never bakes credentials in. `public/config.js` is an empty placeholder for `npm run dev`. The service worker fetches `/config.js` network-first with cache fallback for offline starts.

### Mock Mode Behavior
- **Phone**: any phone number is accepted
- **Code**: any code except `123456` signs in directly
- **2FA**: code `123456` triggers 2FA, password is `password`
- **Data**: dialogs load from `samples/dialogs.json`, messages load from `samples/dialog-media/*.json`, with synthetic fallbacks where needed
- **Media fidelity**: mock mode is suitable for baseline UI validation, not for claiming full production-grade media parity

## State Management

### Store Ownership
| State | Store | Persistence |
|-------|-------|-------------|
| Telegram client / adapter session | `src/stores/telegram.ts` | Session snapshot in localStorage |
| Current dialog | `src/stores/gallery.ts` | No |
| Loaded media items | `src/stores/gallery.ts` | No |
| Viewer state | `src/stores/gallery.ts` | No |
| Scroll positions | `src/stores/gallery.ts` | localStorage |
| Gallery bookmarks | `src/stores/dialogs.ts` | localStorage |
| Last-known dialog snapshot | `src/stores/dialogs.ts` via `src/stores/persisted.ts` | localStorage |
| Dialog search | `src/stores/dialogs.ts` | No |
| User settings | `src/stores/settings.ts` | localStorage |
| Toasts / offline UI | `src/stores/ui.ts` | No |

### Key Stores
- `src/stores/telegram.ts` - adapter initialization, auth state, reconnect flow
- `src/stores/gallery.ts` - current dialog, media paging, viewer state, upload state
- `src/stores/dialogs.ts` - dialog lists, galleries subset, search, bookmarks
- `src/stores/settings.ts` - theme and gallery-related settings
- `src/stores/ui.ts` - toast notifications and offline state

## Supported Authentication Flows

### Phone Login
1. Enter phone number
2. Click `Send Code`
3. Wait for `data-auth-step="code"`
4. Enter verification code
5. Click `Submit Code`
6. If required, enter 2FA password and submit

### QR Login
1. QR token is rendered to canvas
2. Expiration countdown is shown
3. Refresh is available
4. If Telegram requests 2FA, a password field is shown inline

### Session Management
- Session is stored in `localStorage`
- Reconnect is attempted on app initialization
- Logout clears session and returns to auth screen
- Session-expiry and reconnect UI are handled through store-driven banner/toast state

## Navigation And Routing

### Hash Routes
- `#/` - dialog list
- `#/gallery/:dialogId` - gallery screen for selected dialog
- `#/settings` - settings screen

### Screen Markers Used By Tests
- `data-testid="auth-screen"`
- `data-testid="dialogs-screen"`
- `data-testid="gallery-screen"`
- `data-testid="settings-screen"`

## UI Contract Currently Accepted

### Auth Screen
- `src/components/auth/AuthScreen.svelte` exposes Phone and QR as semantic tabs
- `src/components/auth/PhoneForm.svelte` exposes:
  - `phone-input`
  - `send-code-button`
  - `verification-code-input`
  - `submit-code-button`
  - `2fa-password-input`
  - `submit-password-button`
  - `auth-status`
- `src/components/auth/QRForm.svelte` exposes:
  - `qr-form`
  - `qr-canvas`
  - `qr-refresh-button`
  - `qr-2fa-section`
  - `qr-2fa-password-input`
  - `qr-2fa-submit-button`

### Dialog Screen
- `src/components/dialogs/DialogList.svelte` exposes semantic tabs for Galleries / Groups / Chats
- When the app is offline, the dialogs screen explicitly labels cached dialog state and does not claim live freshness.
- Stable hooks include:
  - `galleries-tab`
  - `groups-tab`
  - `chats-tab`
  - `galleries-list`
  - `groups-list`
  - `chats-list`
  - `dialogs-data-status` when offline cached-state messaging is active
  - `dialog-search` when the current tab count exceeds 20
  - `empty-galleries`
- `src/components/dialogs/DialogItem.svelte` exposes:
  - `data-testid="dialog-item"`
  - `data-dialog-id="..."`
  - `data-testid="dialog-toggle-button"`

### Settings Screen
- Settings is a dedicated route-backed screen at `#/settings`
- Settings opens from the dialogs header and closes via a back button
- Storage information is shown inline with clear buttons and no confirmation dialog
- Settings labels the active full-media backend truthfully and reports migration/fallback state for full-media storage
- Settings explains that offline download, forward, and share actions remain disabled until connectivity returns

## Gallery And Viewer Support

### Accepted Gallery Baseline
The accepted gallery baseline is limited to the currently restored behavior:
1. route entry after dialog selection
2. render loaded media items in grid or list mode
3. filter by media type
4. toggle grid/list view
5. open viewer on item activation
6. while offline in the current session, gallery cards keep showing thumbnails only when the thumbnail already exists in IndexedDB or can be generated from locally cached full media; otherwise the card falls back to the normal file/glyph placeholder

### Accepted Viewer Baseline
- Viewer opens from gallery item activation
- Viewer close path is part of the accepted baseline
- Viewer baseline is treated as supported only to the extent validated by the current short suite and status ledger
- While offline, the viewer reads full media only from the local full-media cache (OPFS or IndexedDB fallback); if that full media is missing, the viewer shows an explicit `Not available offline` placeholder
- While offline, viewer download/share buttons stay disabled even when cached full media is viewable, so the controls do not overclaim export capabilities

### Advanced Gallery Features Still Planned Or Not Yet Accepted
Do not claim end-to-end support for these until they are rebuilt and revalidated:
- keyboard gallery navigation beyond validated viewer baseline behavior
- pull-to-refresh
- gallery onboarding hints

## Caching Strategy
- **Thumbnails**: IndexedDB
- **Full media**: OPFS when the browser exposes a usable implementation; otherwise IndexedDB fallback remains active
- **Full-media migration**: legacy IndexedDB full-media entries migrate to OPFS on startup when OPFS is usable; successful entries are removed from IndexedDB, failed entries remain visible and retry on later launches
- **Dialogs**: sanitized last-known dialog snapshot in localStorage for offline bootstrap and reconnect recovery only
- **Service worker cache**: production app shell precache for `/`, `/index.html`, and hashed JS/CSS assets only; Telegram/media payloads are not stored in the service-worker cache
- **Storage breakdown**: shown in settings with separate reporting for thumbnails, active full-media backend, legacy IndexedDB full media when present, and service-worker cache

## Component Layout
```text
src/components/
|- auth/
|  |- AuthScreen.svelte
|  |- PhoneForm.svelte
|  `- QRForm.svelte
|- dialogs/
|  |- DialogList.svelte
|  `- DialogItem.svelte
|- gallery/
|  |- GalleryGrid.svelte
|  |- ViewerWrapper.svelte
|  |- MediaItem.svelte
|  `- MediaListRow.svelte
|- settings/
|  |- SettingsScreen.svelte
|  `- SettingsPanel.svelte
`- ui/
   |- Toast.svelte
   |- OfflineBanner.svelte
   |- ReconnectBanner.svelte
   `- CacheIndicator.svelte
```

## Testing Workflow



## Development Workflow

### Required Order
1. Read `APPLICATION_SPEC.md`
2. Read `STATUS.md`
3. Read the active plan file
4. Update `STATUS.md` before starting non-trivial work
5. Implement or rewrite one logical block
6. Run required validation or record a truthful deferral for documentation-only work
7. Update spec/status to match reality
8. Commit one logical block

### Commit Discipline
- Commit after every logical block of work
- Conventional Commits only: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`
- Record validation and commit results in `STATUS.md`

## Supported Media Types And Gallery Features

### Phase 0 (Foundation) - Implemented
- Photos (native Telegram photos)
- Videos (native Telegram videos)
- Basic upload (single file)
- Grid view with uniform squares
- PhotoSwipe viewer with zoom, swipe, keyboard navigation
- Filter bar with type pills (All, Photos, Videos, Audio, Docs)
- List view with 48px thumbnails/icons
- View mode toggle (grid/list)
- Per-gallery filter state
- Global default hidden filters in settings

### Phase 1 (More Media + List View) - Implemented
- PDF documents (rendered with native browser PDF viewer)
- Audio files (MP3, M4A, AAC, WAV, FLAC, OGG, Opus)
- Text documents (TXT, MD, JSON, CSV, XML, YAML)
- Document images (image/* MIME types sent as documents)
- Document videos (video/* MIME types sent as documents)
- Large file classification (>100MB)
- Media type classification based on MIME type and file extension
- Filter bar with zero-item tabs disabled
- List view shows filename, date, and size

### Phase 2 (Actions) - Implemented
- Multi-select with long-press on mobile, ctrl/meta toggle, shift-range selection
- Bulk download (chained individual downloads) with progress tracking
- Forward to Telegram chat with dialog picker
- Android Share API integration (Web Share API)
- Copy to clipboard (images only) with Clipboard API
- Bulk upload with queue UX and per-file progress
- Upload progress panel with cancel controls
- Selection header with Download, Forward, Share, Copy actions

### Phase 3 (Offline Foundations) - Implemented
- Production app-shell precache with explicit service-worker cache versioning and stale-cache cleanup
- Persisted offline dialog snapshot bootstrap after a prior online sync
- OPFS full-media cache with explicit IndexedDB fallback and resumable migration reporting
- Offline gallery thumbnail reuse and viewer cached-media rendering with explicit uncached placeholder behavior
- Offline guards for download, forward, and share actions so unsupported offline export/relay paths are disabled truthfully

### Phase 3+ (Advanced) - Implemented
- Masonry layout toggle – implemented
- Desktop layout variants – implemented  
- Light theme support – implemented
- Background sync for uploads – implemented
- Pre-fetching for offline browsing – implemented
- Enhanced cache management UI – implemented
- Offline search within cached media – implemented

## Known Issues And Accepted Gaps
1. Upload mode selector (Send as media vs Send as file) now auto‑adjusts for large files: files exceeding Telegram size limits for their media type (photo >10 MB, video >1 GB, audio >200 MB) are automatically sent as documents, with a user‑visible warning toast.
2. Mock mode is sufficient for baseline UI validation but does not prove production-grade Telegram media fidelity.

## Browser Compatibility
- Primary targets: Chrome desktop and Android Chrome (PWA)
- Security-sensitive features require a secure context such as `https://localhost:5173`
- OPFS is optional and may not be available in all environments

## Cross References
- Agent rules: `AGENTS.md`
- Execution ledger: `STATUS.md`
- Active plan: `.kilo/plans/1776295158000-phase-3-offline-kickoff.md`
- Testing guide: `TESTING_STRATEGY.md`
- Mock data reference: `samples/INDEX.md`

---

This document must describe only validated architecture, supported behavior, required workflow rules, and explicitly accepted gaps. Do not use it to preserve stale claims or aspirational completion statements.
