# Telegram Gallery - Application Specification

## Overview
Browser-based photo/video gallery using Telegram as a storage backend. Client-only Svelte 5 PWA with no server component.

## Core Architecture

### Tech Stack
- **Frontend**: Svelte 5 + TypeScript (strict mode)
- **Build Tool**: Vite
- **Telegram Client**: @mtcute/web (MTProto client)
- **Media Viewer**: PhotoSwipe v5
- **Caching**: IndexedDB (thumbnails), OPFS (full media)
- **PWA**: Service Worker for offline capability

### System Boundaries (Hard Rules)
1. **Working directory is project root only** - Never `cd` outside or read/write external paths
2. **No system-level tool installation** - No `apt`, `brew`, `pip install` (outside venv), `npm install -g`
3. **No system configuration modification** - No `/etc/`, `~/.bashrc`, `~/.gitconfig` changes
4. **No external network access** - All builds run inside Docker with `--network host` disabled
5. **Docker networking permanently disabled** - Every `docker run` must include `--network host`
6. **Temporary files use `./tmp/`** - Never system `/tmp/` (gitignored)

### Build Patterns
```bash
# Standard build
docker run --rm --network host \
  -v "$(pwd)":/app -w /app \
  node:20-alpine <command>

# Dev server
docker run --rm --network host \
  -v "$(pwd)":/app -w /app \
  node:20-alpine npm run dev -- --host
```

## State Management

### Stores Architecture
| State | Store | Persistence |
|-------|-------|-------------|
| TelegramClient | `stores/telegram` | In-memory only |
| Auth state | `stores/telegram` | Session → localStorage |
| Current dialog | `stores/gallery` | Not persisted |
| Loaded media items | `stores/gallery` | Not persisted |
| Scroll positions | `stores/gallery` | localStorage (Map) |
| Gallery bookmarks | `stores/dialogs` | localStorage |
| User settings | `stores/settings` | localStorage |

### Key Stores
- **`src/stores/telegram.ts`**: Telegram adapter management, auth state, session handling
- **`src/stores/gallery.ts`**: Media loading, viewer state, current dialog
- **`src/stores/dialogs.ts`**: Dialog lists, gallery pins, search
- **`src/stores/settings.ts`**: User preferences, cache limits, theme
- **`src/stores/ui.ts`**: Toast notifications, offline state

## Adapter Pattern

### TelegramAdapter Interface
All Telegram API calls go through `src/lib/telegram/adapter.ts` interface. Never import `@mtcute/web` directly in feature code.

**Implementations**:
- `src/lib/telegram/mtcute.ts`: Real Telegram API via @mtcute/web
- `src/lib/telegram/mock.ts`: Mock data for testing

**Adapter Switching**:
- Environment: `VITE_USE_MOCK_ADAPTER=true|1|True|TRUE` (supports multiple truthy values)
- UI Toggle: Available in AuthScreen (pre-login) and SettingsPanel (post-login)
- Storage: `localStorage.getItem('telegram.useMock')`
- Function: `switchToMockAdapter(enabled: boolean)` in `stores/telegram.ts`

### Mock Mode Behavior
- **Phone**: Any phone number accepted
- **Code**: Any code except `123456` signs in directly
- **2FA**: Code `123456` triggers 2FA flow, password is `"password"`
- **Data**: Uses `samples/dialogs.json`, falls back to synthetic messages
- **Media**: Returns empty buffers (placeholder implementation)

## Authentication Flows

### Phone Login (`PhoneForm.svelte`)
1. **Phone Entry**: Enter phone → Send Code (Enter key supported)
2. **Code Entry**: Enter verification code → Submit Code (Enter key supported)
3. **2FA Conditional**: Only shown if `signIn()` returns `'2fa_required'`
4. **Password Entry**: Enter 2FA password → Submit Password (Enter key supported)

### QR Login (`QRForm.svelte`)
1. **QR Display**: Shows QR code with expiration countdown
2. **2FA Handling**: Conditional password prompt via `requestPassword()` callback
3. **Auto-refresh**: QR codes expire and refresh automatically

### Session Management
- **Storage**: `localStorage.getItem('session')`
- **Reconnection**: Automatic on app start if session exists
- **Expiry**: Handles `AUTH_KEY_UNREGISTERED` and `SESSION_REVOKED` errors
- **Logout**: Clears session, returns to auth screen

## Navigation & Routing

### Hash-based Routing (`src/lib/routing.ts`)
- **`#/`**: Dialog list (default)
- **`#/gallery/:dialogId`**: Gallery view for specific dialog
- **`#/settings`**: Settings screen

### Route Transitions
- Uses `src/lib/dom/transitions.ts` for animated transitions
- Respects `prefers-reduced-motion` user preference
- Clean listener removal (bound handler instance stored)

## Gallery System

### Media Loading
1. **Dialog Selection**: `setActiveDialog(dialogId)` triggers load
2. **Initial Load**: `loadInitialMedia()` fetches first page
3. **Infinite Scroll**: `loadMoreMedia()` on scroll threshold
4. **Filtering**: Client-side filtering by media type (photos, videos, audio, docs)

### Viewer Integration
1. **Item Click**: Opens `ViewerWrapper.svelte` via `openViewer(items, index)`
2. **PhotoSwipe**: Fullscreen viewer with zoom, swipe, info panel
3. **Keyboard Navigation**: Arrow keys, Escape, Space bar support

### Caching Strategy
- **Thumbnails**: IndexedDB with LRU eviction (`thumbCacheLimit` setting)
- **Full Media**: OPFS with size-based eviction (`maxCacheSizeMb` setting)
- **Service Worker**: App cache for offline PWA capability
- **Storage Breakdown**: Visible in Settings with per-section clear buttons

## UI/UX Patterns

### Design System
- **CSS Variables**: Theme-aware (`--accent`, `--bg-surface`, `--text-primary`, etc.)
- **Responsive**: Mobile-first, touch targets ≥44×44px
- **Accessibility**: ARIA labels, keyboard navigation, focus management
- **Themes**: Dark/Light/System with `applyTheme()` function

### Component Structure
```
src/components/
├── auth/                    # Authentication screens
│   ├── AuthScreen.svelte   # Login shell with phone/QR tabs
│   ├── PhoneForm.svelte    # Phone+code+2FA login
│   └── QRForm.svelte       # QR code login
├── dialogs/                # Dialog management
│   ├── DialogList.svelte   # Main dialog list with tabs
│   └── DialogItem.svelte   # Individual dialog row
├── gallery/                # Media gallery
│   ├── GalleryGrid.svelte  # Main gallery grid/list view
│   ├── ViewerWrapper.svelte # PhotoSwipe fullscreen viewer
│   └── MediaItem.svelte    # Individual media item card
├── settings/               # Settings UI
│   ├── SettingsScreen.svelte # Settings page shell
│   └── SettingsPanel.svelte  # Settings form controls
└── ui/                     # Shared UI components
    ├── Toast.svelte        # Notification toasts
    ├── ReconnectBanner.svelte # Connection status
    └── CacheIndicator.svelte # Storage usage indicator
```

### Keyboard & Gestures
- **Gallery Navigation**: Arrow keys, Enter, Space, Escape
- **Mobile**: Pull-to-refresh, swipe gestures in viewer
- **Global Shortcuts**: `?` for help overlay (if implemented)
- **Selection Mode**: Ctrl/Cmd+Click, Shift+Click ranges

## Testing Strategy

### Mock Testing Flow
1. **Environment**: Set `VITE_USE_MOCK_ADAPTER=1` or use UI toggle
2. **Authentication**: Any phone + any code (except 123456 for 2FA)
3. **Data**: Synthetic dialogs and media from `samples/` directory
4. **Verification**: Test all user flows without Telegram API

### Test Scripts (Placeholder)
- `npm run test:ui`: Playwright UI tests (not yet implemented)
- `npm run test:visual`: Visual regression tests (not yet implemented)

## Development Workflow

### Commit Discipline
1. **Check**: Run `npm run check` (type check) in Docker
2. **Review**: `git add -A && git diff --cached --stat`
3. **Commit**: Conventional Commits (`type: subject` max 72 chars)
4. **Verify**: `git status` to confirm clean working tree

**Commit Types**: `feat` | `fix` | `refactor` | `style` | `chore` | `docs` | `test`

### Agent/Kilo Reference Flow
```
Get Task → Read SPEC → Make Plan → Implement → Update SPEC/Status
```

**When questions arise not in plan**:
1. Read this SPEC document first
2. Check `AGENTS.md` for project-specific rules
3. Review `src/lib/telegram/adapter.ts` for API interface
4. Examine existing components for patterns

### File Locations
- **This SPEC**: `APPLICATION_SPEC.md` (project root)
- **Agent Instructions**: `AGENTS.md` (project rules, architecture)
- **Status Tracking**: `.kilo/status.md` (project status, progress)
- **Plans**: `.kilo/plans/*.md` (implementation plans)
- **Samples**: `samples/` (mock data, documentation)

## Environment Configuration

### Required Files
- **`.env.example`**: Template with all possible variables
- **`.env`**: User's actual environment (DO NOT MODIFY without asking)
- **`.env.local`**: Local overrides (gitignored)

### Key Environment Variables
```env
# Telegram API (from https://my.telegram.org)
VITE_TELEGRAM_API_ID=
VITE_TELEGRAM_API_HASH=

# Mock adapter (development/testing)
# Valid values: true, 1, True, TRUE or false, 0, False, FALSE
VITE_USE_MOCK_ADAPTER=0
```

### Docker vs Compose Usage
- **User Session**: Uses `docker-compose` with `.env` file
- **Agent/Dev Session**: Uses `docker run` directly with env vars
- **Mock Testing**: Agents should use `VITE_USE_MOCK_ADAPTER=1` in docker command, not modify `.env`

## Known Issues & Limitations

### Current Technical Debt
1. **GalleryGrid Component**: Template/script mismatch, many stub functions
2. **TypeScript Errors**: ~45 errors in GalleryGrid (build succeeds)
3. **Mock Media**: Returns empty buffers, not actual sample media
4. **Test Coverage**: Playwright tests not yet implemented

### Browser Compatibility
- **Primary**: Chrome desktop + Android Chrome (PWA)
- **Requirements**: WebCrypto API, IndexedDB, OPFS (optional)
- **Security**: Must run on `https://` or `http://localhost` for WebCrypto

## Cross-References

### Related Documentation
- `AGENTS.md` - Project rules, commit discipline, architecture
- `.kilo/status.md` - Current project status, completed work
- `samples/INDEX.md` - Mock data specification
- `TECHNICAL_MIGRATION_PLAN.md` - Original migration plan

### Key Implementation Files
- `src/App.svelte` - Root component, startup flow, screen switching
- `src/lib/telegram/adapter.ts` - Adapter interface definition
- `src/stores/telegram.ts` - Adapter switching, auth state
- `src/components/auth/AuthScreen.svelte` - Login with mock toggle
- `src/components/settings/SettingsPanel.svelte` - Settings with mock toggle

---

*This document is maintained as the single source of truth for Telegram Gallery architecture and implementation details. Update when making significant changes to patterns, flows, or architecture.*