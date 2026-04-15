# Telegram Gallery - Application Specification

## Overview
Browser-based photo/video gallery using Telegram as a storage backend. Client-only Svelte 5 PWA with no server component.

## Document Authority
- `APPLICATION_SPEC.md` is the architecture and supported-behavior source of truth.
- `.kilo/status.md` is the execution ledger for active plans, todo states, validations, blockers, and commits.
- `AGENTS.md` defines the required execution workflow and document-maintenance rules.
- If code, spec, and status disagree, reconcile the documents before claiming a feature or flow is complete.

## Current Supported State
- Auth baseline is supported through the real app shell and the mock adapter.
- Dialog browsing baseline is supported, including Galleries / Groups / Chats tabs and conditional search.
- Settings baseline is supported as a dedicated screen with inline cache/storage actions.
- Gallery baseline and viewer baseline have recently been rebuilt and are the accepted baseline target, but advanced gallery capabilities are still not accepted as restored until they are revalidated and recorded in `.kilo/status.md`.
- This document does not claim that all historical gallery, upload, download, share, cache, or mobile flows are currently restored.

## Core Architecture

### Tech Stack
- **Frontend**: Svelte 5 + TypeScript strict
- **Build Tool**: Vite
- **Telegram Client**: `@mtcute/web`
- **Media Viewer**: PhotoSwipe v5
- **Caching**: IndexedDB for thumbnails, OPFS for full-media cache in later phases
- **PWA**: Manifest is part of the app; broader offline/service-worker behavior remains phase-scoped

### System Boundaries
1. **Working directory is project root only** - never read or write outside the repo.
2. **No system-level tool installation** - do not modify the host OS.
3. **No system configuration modification** - do not touch shell, git, or service config outside the repo.
4. **No external access** - do not access remote services or external network resources.
5. **All builds run inside Docker with `--network host`** - every project `docker run` must include `--network host`.
6. **Temporary files use `./tmp/`** - never use system `/tmp/`.
7. **Dev server must use port `5173`** - keep that port fixed for local validation.

### Standard Build Patterns
```bash
# Type check / build pattern
docker run --rm --network host \
  -v "$(pwd)":/app -w /app \
  node:20-alpine <command>

# Dev server pattern
docker run --rm --network host \
  -v "$(pwd)":/app -w /app \
  node:20-alpine npm run dev -- --host --port 5173
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
- Stable hooks include:
  - `galleries-tab`
  - `groups-tab`
  - `chats-tab`
  - `galleries-list`
  - `groups-list`
  - `chats-list`
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

## Gallery And Viewer Support

### Accepted Gallery Baseline
The accepted gallery baseline is limited to the currently restored behavior:
1. route entry after dialog selection
2. render loaded media items in grid or list mode
3. filter by media type
4. toggle grid/list view
5. open viewer on item activation

### Accepted Viewer Baseline
- Viewer opens from gallery item activation
- Viewer close path is part of the accepted baseline
- Viewer baseline is treated as supported only to the extent validated by the current short suite and status ledger

### Advanced Gallery Features Not Yet Accepted As Restored
Do not claim end-to-end support for these until they are rebuilt and revalidated:
- UI-layer infinite scroll restoration
- bulk selection and bulk actions
- download / share / copy / forward flows
- gallery onboarding hints
- masonry layout
- keyboard gallery navigation beyond validated viewer baseline behavior
- pull-to-refresh
- advanced upload UX beyond what is explicitly revalidated later

These paths may exist partially in code or stores, but they are not currently accepted as supported behavior.

## Caching Strategy
- **Thumbnails**: IndexedDB
- **Full media**: OPFS where available in later phases
- **Service worker cache**: app/offline shell resources when phase-scoped work restores that behavior
- **Storage breakdown**: shown in settings with clear actions for each cache area

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

### Required Validation Policy
- `npm run check` must pass before a logical block is complete unless the block is intentionally documentation-only and the deferral is recorded in `.kilo/status.md`.
- Required Playwright suites must contain executable assertions only.
- Commented-out, placeholder, or speculative tests do not satisfy process gates.

### Test Commands
Current repo scripts include:
- `npm run check`
- `npm run test:short`
- `npm run test:long`
- `npm run test:all`
- `npm run test:ui`
- `npm run test:visual`

### Docker Compose Test Flow
Use Docker Compose for Playwright validation:
```bash
docker-compose up --build playwright

# Specific suite/project example
docker-compose run --rm playwright npx playwright test --config=playwright.config.ts --grep "@short" --project=desktop-chrome
```

### Current Required Short-Test Contract
Short tests are intended to validate only currently supported baseline behavior:
- auth screen rendering and auth flows
- dialogs screen rendering and tab semantics
- settings open/close baseline
- gallery baseline when accepted in current status
- viewer baseline when accepted in current status

### Current Long-Test Policy
- Long tests must cover only executable, supported flows.
- If an advanced flow is not restored end-to-end, it must not remain as a required assertion.
- Unsupported advanced behavior must be tracked as a gap instead of being hidden behind weakened tests.

## Development Workflow

### Required Order
1. Read `APPLICATION_SPEC.md`
2. Read `.kilo/status.md`
3. Read the active plan file
4. Update `.kilo/status.md` before starting non-trivial work
5. Implement or rewrite one logical block
6. Run required validation or record a truthful deferral for documentation-only work
7. Update spec/status to match reality
8. Commit one logical block

### Commit Discipline
- Commit after every logical block of work
- Conventional Commits only: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`
- Record validation and commit results in `.kilo/status.md`

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

### Phase 2 (Actions) - Partially Implemented / Planned
- Multi-select with long-press on mobile
- Bulk download (chained individual downloads)
- Forward to Telegram chat
- Android Share API integration
- Copy to clipboard (images only)
- Bulk upload with queue UX
- Upload progress panel
- Dialog picker for forwarding

### Phase 3+ (Advanced) - Planned
- OPFS full-media cache
- Service worker for offline shell
- Masonry layout toggle
- Desktop layout variants
- Light theme support

## Known Issues And Accepted Gaps
1. Phase 2 actions (multi-select, bulk operations) are not yet implemented.
2. Upload mode selector (Send as media vs Send as file) needs refinement for large files.
3. Some production code still contains direct `console.*` usage and must be aligned with `src/lib/debug.ts` or removed in later code work.
4. Mock mode is sufficient for baseline UI validation but does not prove production-grade Telegram media fidelity.

## Browser Compatibility
- Primary targets: Chrome desktop and Android Chrome (PWA)
- Security-sensitive features require a secure context such as `https://localhost:5173`
- OPFS is optional and may not be available in all environments

## Cross References
- Agent rules: `AGENTS.md`
- Execution ledger: `.kilo/status.md`
- Active recovery plan: `.kilo/plans/1776176222439-sunny-river.md`
- Testing guide: `TESTING_STRATEGY.md`
- Mock data reference: `samples/INDEX.md`

---

This document must describe only validated architecture, supported behavior, required workflow rules, and explicitly accepted gaps. Do not use it to preserve stale claims or aspirational completion statements.
