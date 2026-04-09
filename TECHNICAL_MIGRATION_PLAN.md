# Technical Migration Plan
## Telegram Gallery — Spec-Driven Rewrite

| | |
|---|---|
| **Document Status** | DRAFT — Pending Stakeholder Review |
| **Version** | 0.1 |
| **Date** | 2026-04-09 |
| **Prepared By** | Solutions Architecture |
| **Primary Reference** | `kilo-dev-process.md` |
| **Next Gate** | Executive Implementation Plan sign-off |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope and Objectives](#2-scope-and-objectives)
3. [Current State Assessment](#3-current-state-assessment)
4. [Target Architecture](#4-target-architecture)
5. [Prioritization Framework](#5-prioritization-framework)
6. [Module Migration Catalogue](#6-module-migration-catalogue)
7. [Migration Strategy](#7-migration-strategy)
8. [Milestone Plan](#8-milestone-plan)
9. [High-Level Timeline](#9-high-level-timeline)
10. [Risk Register and Mitigation](#10-risk-register-and-mitigation)
11. [Definition of Done](#11-definition-of-done)
12. [Stakeholder Review Notes](#12-stakeholder-review-notes)
13. [Open Questions](#13-open-questions)

---

## 1. Executive Summary

The Telegram Gallery application is a browser-based media viewer that uses Telegram as a storage backend. The MVP was delivered as a functional proof-of-concept in a single JavaScript file of 1,868 lines with no architectural boundaries, no type safety, and several documented memory and UX defects.

This document defines the Technical Migration Plan for a spec-driven rewrite. The rewrite preserves 100% of the MVP's user-facing functionality and core business principles while establishing a maintainable, testable, and extensible codebase. The migration is structured as five sequential phases, each independently releasable, with the first two phases prioritised to eliminate the highest-severity technical debt without adding new features.

**Strategic constraints that must be honoured throughout migration:**

- The application remains purely client-side; no server-side component is introduced.
- GramJS (`telegram ^2.26.22`) remains the Telegram API client.
- IndexedDB remains the persistence layer for media blobs.
- The five primary user flows (Authenticate, Browse Dialogs, View Gallery, View Fullscreen, Manage Cache) must be functionally identical in every release.

---

## 2. Scope and Objectives

### 2.1 In Scope

| Area | Description |
|------|-------------|
| Code architecture | Decompose `main.js` monolith into eight bounded ES modules |
| Type safety | Add TypeScript across all modules with strict compiler settings |
| Defect remediation | Fix all ten documented technical debt items from `kilo-dev-process.md § 8` |
| UX hardening | Replace `alert()`/`confirm()` with non-blocking notifications; surface errors in UI |
| Performance | Resolve `URL.createObjectURL` memory leaks; evaluate virtual scrolling |
| Developer experience | Establish linting, formatting, and a CI build gate |

### 2.2 Out of Scope

| Area | Rationale |
|------|-----------|
| Server-side infrastructure | Core architectural constraint — Telegram is the backend |
| User authentication redesign | GramJS MTProto flow is non-negotiable; UI polish only |
| New media type support (e.g., audio, documents) | Post-GA feature consideration |
| Multi-account support | Not in MVP; requires significant state architecture work |
| Native mobile apps | Web-only; PWA enhancements deferred to Phase 5 |
| Backend caching / CDN | No server; all caching remains client-side IndexedDB |

### 2.3 Success Criteria

1. All five primary user flows pass manual regression testing on both desktop Chrome and mobile Safari.
2. TypeScript compiler reports zero errors with `strict: true`.
3. No `alert()` or `confirm()` calls present in production code.
4. `URL.revokeObjectURL()` is called for every object URL created.
5. `window.thumbnailObserver` global eliminated; observer scoped to gallery module.
6. Console contains zero debug-level `console.log` calls in production builds.
7. Dialog list supports pagination beyond the hardcoded 100-dialog limit.
8. Offline connection loss handled with a visible error state rather than a silent failure.

---

## 3. Current State Assessment

### 3.1 Architecture Snapshot

The MVP is a single-page application with four HTML screens managed by direct `display` style toggling. All application logic is co-located in one file (`main.js`), producing tight coupling between authentication, data fetching, DOM rendering, caching, and routing.

```
src-reference/
├── index.html      150 lines   HTML shell for all screens
├── main.js        1868 lines   Entire application (monolith)
├── style.css       643 lines   Global stylesheet
└── vite.config.js   14 lines   Build config
```

### 3.2 Dependency Map (Current)

```
main.js
  ├── telegram (GramJS)          ← auth, dialog fetch, media download
  ├── telegram/sessions          ← StringSession
  ├── telegram/tl/api.js         ← API method constructors (dynamic import)
  ├── telegram/Password.js       ← SRP 2FA compute (dynamic import)
  ├── buffer                     ← Buffer polyfill
  └── Browser APIs
        ├── localStorage          ← session, settings, galleryIds, currentView
        ├── IndexedDB             ← thumbnail and full-image blob cache
        ├── IntersectionObserver  ← lazy thumbnail loading
        └── history.replaceState  ← URL routing
```

### 3.3 Technical Debt Inventory

Sourced from `kilo-dev-process.md § 8`. Severity is assessed against impact on correctness, user experience, and maintainability.

| ID | Description | Severity | Phase to Resolve |
|----|-------------|----------|-----------------|
| TD-01 | Monolithic `main.js` — zero separation of concerns | Critical | Phase 1 |
| TD-02 | No error boundaries — failures invisible to user | High | Phase 1 |
| TD-03 | Dialog limit hardcoded to 100 | High | Phase 1 |
| TD-04 | `window.thumbnailObserver` global — fragile coupling | Medium | Phase 1 |
| TD-05 | No TypeScript — no type safety on GramJS responses | High | Phase 2 |
| TD-06 | `console.log` debug noise in production path | Low | Phase 2 |
| TD-07 | `URL.createObjectURL` leaks — `revokeObjectURL` never called | Medium | Phase 2 |
| TD-08 | `alert()`/`confirm()` for settings feedback — disruptive UX | Medium | Phase 4 |
| TD-09 | `downloadCurrentMedia()` broken for `document-video` type | Medium | Phase 1 |
| TD-10 | No offline handling — silent failure on connection drop | High | Phase 4 |

### 3.4 Functional Completeness Baseline

The following features are confirmed implemented and must be preserved identically:

| Feature | Location in `main.js` | Status |
|---------|----------------------|--------|
| Phone + code authentication | Lines 350–429 | Verified |
| 2FA password authentication | Lines 431–465 | Verified |
| Session auto-reconnect | Lines 318–340 | Verified |
| ENV credential pre-population | Lines 290–312 | Verified |
| Dialog list (groups, chats) | Lines 631–762 | Verified |
| Gallery bookmarking | Lines 824–857 | Verified |
| Tab navigation + search | Lines 520–628 | Verified |
| Photo grid with lazy loading | Lines 1034–1241 | Verified |
| IntersectionObserver thumbnails | Lines 1182–1228 | Verified |
| Infinite scroll pagination | Lines 1325–1364 | Verified |
| Fullscreen viewer | Lines 1372–1531 | Verified |
| Full-quality download w/ progress | Lines 1533–1763 | Verified |
| Large file preview card (>100MB) | Lines 1249–1269 | Verified |
| Keyboard navigation (←/→/Esc) | Lines 1818–1824 | Verified |
| Hash-based URL routing | Lines 1826–1868 | Verified |
| IndexedDB thumbnail cache | Lines 148–190 | Verified |
| IndexedDB full-image cache | Lines 148–190 | Verified |
| LRU cache pruning | Lines 202–268 | Verified |
| Cache statistics UI | Lines 947–987 | Verified |
| Settings persistence | Lines 102–104 | Verified |
| Mobile/desktop responsive grid | Lines 56–99 | Verified |
| Media download button | Lines 1788–1815 | Verified |

---

## 4. Target Architecture

### 4.1 Module Boundary Design

The target architecture decomposes the monolith into eight modules with explicit dependency boundaries. Each module owns a single domain and exposes a minimal public API.

```
src/
├── main.js                 ← Entry point / wiring layer only
│
├── auth/
│   └── index.js            ← TelegramClient lifecycle, auth flow, session
│
├── cache/
│   └── index.js            ← IndexedDB wrapper, LRU pruning, stats
│
├── settings/
│   └── index.js            ← localStorage preferences, grid config
│
├── dialogs/
│   └── index.js            ← Dialog fetch, render, filter, bookmark
│
├── gallery/
│   └── index.js            ← Media grid, pagination, lazy loading
│
├── viewer/
│   └── index.js            ← Fullscreen lightbox, download
│
├── router/
│   └── index.js            ← Hash routing, popstate handling
│
└── utils/
    └── format.js           ← Pure formatting utilities
```

### 4.2 Dependency Graph (Target)

```
main.js
  ├── auth/index        ← GramJS, localStorage
  ├── cache/index       ← browser IndexedDB, settings/index, utils/format
  ├── settings/index    ← browser localStorage
  ├── dialogs/index     ← auth/index (client ref)
  ├── gallery/index     ← auth/index, cache/index, settings/index, utils/format
  ├── viewer/index      ← auth/index, cache/index, gallery/index (photos), utils/format
  ├── router/index      ← dialogs/index, gallery/index, viewer/index
  └── utils/format      ← (no dependencies)
```

**Constraint**: No circular dependencies permitted. Dependency arrows flow strictly downward in the layer ordering: `utils → settings/cache → auth → dialogs/gallery/viewer → router → main`.

### 4.3 State Management Approach

The MVP uses 14 module-level global variables in a single scope. The target architecture distributes state ownership as follows:

| State | Owner Module | Persistence |
|-------|-------------|-------------|
| `client` | `auth` | In-memory |
| `currentDialog` | `gallery` | In-memory |
| `photos[]` | `gallery` | In-memory |
| `currentPhotoIndex` | `viewer` | In-memory |
| `lastOffsetId`, `hasMorePhotos`, `isLoadingMore` | `gallery` | In-memory |
| `currentLoadId` | `viewer` | In-memory |
| `allDialogs[]` | `dialogs` | In-memory |
| `imageDB` | `cache` | IndexedDB handle |
| `galleryIds[]` | `dialogs` | localStorage |
| `currentView` | `main` | localStorage |
| `phoneCodeHash` | `auth` | In-memory |
| Cache settings | `settings` | localStorage |
| Grid column preference | `settings` | localStorage |

### 4.4 TypeScript Interface Contracts

The following core interfaces must be defined and shared across modules:

```typescript
interface MediaItem {
  message: TelegramMessage;
  type: 'photo' | 'video' | 'document-image' | 'document-video' | 'large-image' | 'large-video';
}

interface CacheRecord {
  id: string;           // `${dialogId}_${messageId}`
  blob: Blob;
  timestamp: number;
}

interface AppSettings {
  thumbnails: number;
  fullImages: number;
  maxSizeMB: number;
  gridColumns: number;
  gridOptions?: number[];
}

interface DevicePreset {
  desktop: AppSettings;
  mobile: AppSettings;
}
```

---

## 5. Prioritization Framework

### 5.1 Scoring Criteria

Each module is evaluated against four dimensions to determine migration sequence. Scores range from 1 (lowest) to 5 (highest).

| Dimension | Definition | Weight |
|-----------|-----------|--------|
| **Business Value** | How directly does this module support user-facing value delivery? | 30% |
| **Dependency Position** | How many other modules depend on this one? Higher position = migrate first. | 30% |
| **Defect Exposure** | How many active technical debt items does this module carry? | 25% |
| **Complexity Risk** | How difficult is the migration? Lower complexity = safer to move early. | 15% |

**Priority Score** = (Business Value × 0.30) + (Dependency Position × 0.30) + (Defect Exposure × 0.25) + ((6 − Complexity Risk) × 0.15)

> Note: Complexity Risk is inverted — simpler modules score higher because they are safer to migrate first, establishing confidence before tackling harder units.

### 5.2 Module Scoring Matrix

| Module | Business Value | Dependency Position | Defect Exposure | Complexity Risk | **Priority Score** | Migration Wave |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| `utils/format` | 1 | 5 | 1 | 1 | **3.50** | Wave 1 |
| `settings` | 2 | 5 | 1 | 1 | **3.20** | Wave 1 |
| `cache` | 3 | 5 | 2 | 3 | **3.60** | Wave 1 |
| `auth` | 5 | 4 | 1 | 4 | **3.45** | Wave 2 |
| `dialogs` | 4 | 3 | 2 | 3 | **3.00** | Wave 2 |
| `gallery` | 5 | 2 | 4 | 5 | **3.35** | Wave 3 |
| `viewer` | 5 | 1 | 3 | 5 | **2.90** | Wave 3 |
| `router` | 3 | 1 | 1 | 2 | **2.10** | Wave 4 |

### 5.3 Wave Rationale

**Wave 1 — Foundation (utils, settings, cache)**  
Zero external API dependencies. Can be written, tested, and verified in complete isolation before any Telegram connection is required. Resolves TD-07 (object URL leaks addressed in cache) and provides the type-safe primitives all other modules depend on.

**Wave 2 — API Boundary (auth, dialogs)**  
These modules own the GramJS connection and the dialog data layer. Migrating auth first provides a stable, typed `client` reference for all subsequent waves. Dialogs follows immediately because it is the first consumer of a live client instance. Resolves TD-03 (dialog limit).

**Wave 3 — Core User Experience (gallery, viewer)**  
The most complex modules and the ones carrying the highest defect exposure. By Wave 3, all dependencies (cache, settings, auth, dialogs) are stable and typed, dramatically reducing integration risk. Resolves TD-04 (`window.thumbnailObserver`), TD-09 (video download bug).

**Wave 4 — Routing and Wiring (router, main)**  
Router is last because it depends on stable public APIs from gallery and viewer. The `main.js` wiring layer is refactored only once all modules are stable, replacing the final fragments of the monolith.

---

## 6. Module Migration Catalogue

Each module entry defines the acceptance criteria that must be satisfied before the module is considered migration-complete.

---

### 6.1 `utils/format`

**Wave**: 1  
**Source lines**: 1766–1786 (`src-reference/main.js`)  
**Dependencies**: None  
**Defects resolved**: None directly; enables type-safe consumption across all modules.

**Functions to migrate**:
- `formatBytes(bytes: number): string`
- `formatBytesNoDecimal(bytes: number): string`
- `formatDuration(seconds: number): string`

**Acceptance Criteria**:
- [ ] All three functions exported as named exports from `src/utils/format.ts`
- [ ] Unit tests cover zero, byte, KB, MB, and GB boundaries for both format functions
- [ ] `formatDuration` tested for sub-minute, exact-minute, and multi-minute inputs
- [ ] No runtime `console.log` statements

---

### 6.2 `settings`

**Wave**: 1  
**Source lines**: 19–103 (`src-reference/main.js`)  
**Dependencies**: None (browser `localStorage`, `navigator.userAgent`, `window.innerWidth`)  
**Defects resolved**: TD-06 (remove debug logs from settings path)

**Functions to migrate**:
- `isMobileDevice(): boolean`
- `getSettings(): AppSettings`
- `saveSettings(settings: AppSettings): void`
- `getGridOptions(): number[]`
- `getGridColumns(): number`
- `setGridColumns(columns: number): void`
- `applyGridColumns(columns: number): void`
- `cycleGridZoom(): void`
- `updateZoomButtonLabel(): void`
- `DEFAULT_SETTINGS: DevicePreset` (exported constant)

**Acceptance Criteria**:
- [ ] `AppSettings` and `DevicePreset` TypeScript interfaces defined and exported
- [ ] `isMobileDevice()` mocked correctly in tests (userAgent and viewport)
- [ ] `getSettings()` merges saved values with defaults for any newly added setting keys
- [ ] `saveSettings()` round-trips correctly through `JSON.parse`/`JSON.stringify`
- [ ] Grid column cycling wraps at end of `gridOptions` array
- [ ] No `any` TypeScript types used

---

### 6.3 `cache`

**Wave**: 1  
**Source lines**: 117–914 (`src-reference/main.js`)  
**Dependencies**: `settings` (for limits), `utils/format` (for pruning logs)  
**Defects resolved**: TD-07 (`URL.revokeObjectURL` — object URL lifecycle policy documented and enforced as a module contract here)

**Functions to migrate**:
- `initImageCache(): Promise<IDBDatabase>`
- `getCachedImage(dialogId, messageId, type): Promise<Blob | null>`
- `cacheImage(dialogId, messageId, blob, type): Promise<void>`
- `pruneCache(storeName): Promise<void>`
- `getCacheTotalSize(storeName): Promise<number>`
- `getCacheStats(): Promise<CacheStats | null>`
- `clearCache(): Promise<void>`

**Acceptance Criteria**:
- [ ] `CacheRecord` and `CacheStats` TypeScript interfaces defined and exported
- [ ] `initImageCache()` is idempotent — calling twice does not corrupt the database
- [ ] `pruneCache()` evicts oldest entries first (sorted by `timestamp` ascending)
- [ ] Count-based pruning verified for `thumbnails` store
- [ ] Count + size-based pruning verified for `fullImages` store
- [ ] `clearCache()` empties both stores
- [ ] All IndexedDB operations handle `onerror` without throwing to callers
- [ ] Object URL management contract documented in module JSDoc: cache module stores only blobs; callers are responsible for `URL.createObjectURL`/`URL.revokeObjectURL` lifecycle

---

### 6.4 `auth`

**Wave**: 2  
**Source lines**: 289–477 (`src-reference/main.js`)  
**Dependencies**: GramJS, browser `localStorage`  
**Defects resolved**: TD-02 (partial — auth errors now propagate via typed callback rather than silent catch)

**Functions to migrate**:
- `getStoredCredentials(): StoredCredentials`
- `reconnect(onStatus, onSuccess): Promise<void>`
- `sendCode(apiId, apiHash, phone, onStatus, onCodeSent): Promise<void>`
- `submitCode(code, onStatus, onSuccess, on2FARequired): Promise<void>`
- `submitPassword(password, onStatus, onSuccess): Promise<void>`
- `logout(): Promise<void>`

**Exported state**: `client: TelegramClient | null` (live reference, not a copy)

**Acceptance Criteria**:
- [ ] `StoredCredentials` interface typed with `apiId`, `apiHash`, `session`, `envApiId`, `envApiHash`
- [ ] `client` exported as a module-level `let` binding, not a getter function
- [ ] All auth state callbacks (`onStatus`, `onSuccess`, `on2FARequired`) typed as `() => void` or `(msg: string) => void`
- [ ] `SESSION_PASSWORD_NEEDED` error correctly triggers `on2FARequired` callback
- [ ] ENV credentials take precedence over localStorage credentials in `getStoredCredentials()`
- [ ] `logout()` clears localStorage and calls `client.invoke(auth.LogOut)` before reload
- [ ] Error messages passed to `onStatus` include the original `error.message` string

---

### 6.5 `dialogs`

**Wave**: 2  
**Source lines**: 483–838 (`src-reference/main.js`)  
**Dependencies**: `auth` (for `client`), browser `localStorage`  
**Defects resolved**: TD-03 (pagination support for >100 dialogs)

**Functions to migrate**:
- `loadDialogs(): Promise<void>`
- `renderGalleriesList(onDialogClick, onRemove): void`
- `renderGroupsList(onDialogClick, onToggle): void`
- `renderChatsList(onDialogClick, onToggle): void`
- `addToGallery(id, onUpdate): void`
- `removeFromGallery(id, onUpdate): void`
- `toggleGallery(id, onUpdate): void`
- `filterGalleries(query): void`
- `filterGroups(query): void`
- `filterChats(query): void`

**Exported state**: `allDialogs: Dialog[]`, `galleryIds: string[]`

**Acceptance Criteria**:
- [ ] `loadDialogs()` paginates beyond 100 dialogs (use `offsetDate` or `offsetId` continuation)
- [ ] Dialog entity classification is type-guarded — no raw `className.includes()` string matching in exported functions
- [ ] `galleryIds` persisted atomically — localStorage write occurs before `onUpdate` callback fires
- [ ] `toggleGallery()` is idempotent — calling twice returns to original state
- [ ] Filter functions are case-insensitive and handle empty string (show all)
- [ ] Empty states rendered correctly when `galleryIds` is empty or `allDialogs` is empty

---

### 6.6 `gallery`

**Wave**: 3  
**Source lines**: 1034–1365 (`src-reference/main.js`)  
**Dependencies**: `auth`, `cache`, `settings`, `utils/format`  
**Defects resolved**: TD-04 (`window.thumbnailObserver` eliminated), TD-09 (video download scoped to gallery type classification)

**Functions to migrate**:
- `loadGallery(dialog, reset, onOpenFullscreen): Promise<void>`
- `checkAndLoadMore(onOpenFullscreen): void`
- `loadThumbnail(photoItem, dialog, item): Promise<void>`

**Exported state**: `currentDialog: Dialog | null`, `photos: MediaItem[]`

**Acceptance Criteria**:
- [ ] `MediaItem` TypeScript interface defined with `message` and `type` literal union
- [ ] `thumbnailObserver` stored as module-level variable, not on `window`
- [ ] Race condition guard (`loadingDialog` comparison) preserved identically
- [ ] `CHUNK_SIZE` (200) and `MAX_AUTO_LOAD` (100MB) defined as named constants, not magic numbers
- [ ] Media type classification logic extracted into a pure function `classifyMessage(msg): MediaItem | null`
- [ ] Large-file preview card renders for both `large-image` and `large-video` types
- [ ] Infinite scroll threshold (100 remaining photos) triggers next chunk load
- [ ] `IntersectionObserver` disconnected and nulled when navigating back to galleries list
- [ ] `URL.revokeObjectURL` called for thumbnail object URLs when `photoItem` is removed from DOM

---

### 6.7 `viewer`

**Wave**: 3  
**Source lines**: 1366–1815 (`src-reference/main.js`)  
**Dependencies**: `auth`, `cache`, `gallery` (photos, currentDialog), `utils/format`  
**Defects resolved**: TD-07 (full-image object URL revoked on viewer close/navigate), TD-09 (`downloadCurrentMedia` fixed for `document-video`)

**Functions to migrate**:
- `openFullscreen(index: number): Promise<void>`
- `closeFullscreen(): void`
- `navigateImage(direction: -1 | 1): void`
- `loadFullImage(): Promise<void>`
- `downloadCurrentMedia(): void`

**Exported state**: `currentPhotoIndex: number`

**Acceptance Criteria**:
- [ ] `currentLoadId` monotonic counter prevents stale async callback execution
- [ ] Two-step loading (thumbnail first, then full quality) preserved with the same UX timing
- [ ] Progress callback updates `#image-info` for all non-cached downloads
- [ ] `URL.revokeObjectURL` called for the previous image/video URL before loading a new one
- [ ] `downloadCurrentMedia()` works for all six `MediaItem` types, not only native `video`
- [ ] Large file download button (`loadLargeFile`) correctly invokes progress reporting
- [ ] `closeFullscreen()` pauses video and clears `video.src` before hiding viewer
- [ ] Navigation wraps: index 0 − 1 → last item; last + 1 → index 0

---

### 6.8 `router`

**Wave**: 4  
**Source lines**: 1826–1868 (`src-reference/main.js`)  
**Dependencies**: `dialogs`, `gallery`, `viewer`  
**Defects resolved**: None directly

**Functions to migrate**:
- `initRouter(): void`

**Acceptance Criteria**:
- [ ] `popstate` handler registered exactly once via `initRouter()`
- [ ] Empty hash (`''` or `#`) triggers: close fullscreen if open, then return to galleries list
- [ ] `#/gallery/:id` hash opens correct gallery by dialog ID string comparison
- [ ] `#/gallery/:id/:msgId` hash opens gallery + fullscreen for matching message ID
- [ ] Navigation guard prevents reopening viewer if already open with same item

---

## 7. Migration Strategy

### 7.1 Approach: Strangler Fig Pattern

The migration uses a Strangler Fig pattern — the modular `src/` tree grows alongside the untouched `main.js` monolith. The application entry point (`index.html`) switches to `src/main.js` once a complete phase is stable. This means:

- At any point during migration, the `legacy-archive` branch provides a known-good fallback.
- `src-reference/` provides per-function reference during implementation.
- No "flag day" rewrite — each wave is independently deployable and testable.

### 7.2 Branch Strategy

```
legacy-archive  ←  frozen at MVP commit; never modified
main            ←  integration branch; only receives squash-merged phase branches
  └── phase/1-foundation      ← Wave 1 work (utils, settings, cache)
  └── phase/2-api-boundary    ← Wave 2 work (auth, dialogs)
  └── phase/3-ux-core         ← Wave 3 work (gallery, viewer)
  └── phase/4-routing-wiring  ← Wave 4 work (router, main wiring)
  └── phase/5-hardening       ← TD-08 (toasts), TD-10 (offline), performance
```

Each phase branch is squash-merged into `main` after its gate review passes. Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).

### 7.3 Testing Strategy

Given the MVP has zero tests, a testing pyramid is introduced progressively:

| Phase | Test Type | Tooling | Coverage Target |
|-------|-----------|---------|----------------|
| Phase 1 | Unit tests for utils, settings, cache | Vitest | 90% statement |
| Phase 2 | Unit tests for auth callbacks; mock GramJS | Vitest + vitest-mock | 80% statement |
| Phase 3 | Integration tests for gallery + viewer with mock client | Vitest + jsdom | 70% statement |
| Phase 4 | End-to-end smoke test for all five primary user flows | Playwright | 5 flows × 2 platforms |
| Phase 5 | Performance regression test (Lighthouse CI) | Lighthouse CI | — |

**Mocking policy**: GramJS is not imported in unit tests. A typed mock interface replaces it at module boundaries. This enforces clean dependency injection and makes tests deterministic.

### 7.4 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

Vite handles TypeScript compilation; `tsc --noEmit` runs in CI as a type-check gate independent of the build.

### 7.5 Code Quality Gates

The following checks must pass on every pull request before merge:

- `tsc --noEmit` — zero type errors
- ESLint with `@typescript-eslint/recommended` — zero errors
- Prettier — zero formatting violations
- Vitest — all tests pass, coverage thresholds met for the phase

---

## 8. Milestone Plan

### Milestone 1 — Foundation Complete *(Wave 1)*

**Exit Criteria**:
- `src/utils/format.ts`, `src/settings/index.ts`, `src/cache/index.ts` implemented
- All TypeScript interfaces for `AppSettings`, `CacheRecord`, `CacheStats` defined
- Unit test suite passing for all three modules
- CI pipeline established (type-check + lint + test)
- TD-06 resolved (no `console.log` in production paths)
- TD-07 object URL contract documented in `cache` module

**Deliverable**: Pull request `phase/1-foundation` approved and merged to `main`.

---

### Milestone 2 — API Boundary Stable *(Wave 2)*

**Exit Criteria**:
- `src/auth/index.ts` and `src/dialogs/index.ts` implemented
- `StoredCredentials` and dialog entity types defined
- Auth flow manually tested end-to-end with real Telegram credentials in development
- TD-02 (partial): all auth errors surface to `onStatus` callback
- TD-03: dialog list paginates correctly past 100 dialogs
- Unit tests for `settings`, `cache`, and `utils` continue to pass

**Deliverable**: Pull request `phase/2-api-boundary` approved and merged to `main`.

---

### Milestone 3 — Core UX Parity *(Wave 3)*

**Exit Criteria**:
- `src/gallery/index.ts` and `src/viewer/index.ts` implemented
- All five primary user flows pass manual regression on Chrome desktop and mobile Safari
- TD-04: `window.thumbnailObserver` removed
- TD-07: `URL.revokeObjectURL` called in gallery (thumbnails) and viewer (full images)
- TD-09: `downloadCurrentMedia()` works for `document-video` type
- `index.html` entry point switched to `src/main.ts`; monolithic `main.js` moved to `src-reference/`
- Integration tests passing

**Deliverable**: Pull request `phase/3-ux-core` approved and merged. **This is the first production-deployable release of the rewrite.**

---

### Milestone 4 — Routing and Wiring Clean *(Wave 4)*

**Exit Criteria**:
- `src/router/index.ts` implemented
- `src/main.ts` wiring layer contains zero business logic (event binding and module init only)
- All hash URL patterns (`#/gallery/:id`, `#/gallery/:id/:msgId`, empty) verified in Playwright E2E tests
- Zero `any` TypeScript types across entire `src/` tree
- TD-01 fully resolved: `src-reference/main.js` is the last location of monolithic code

**Deliverable**: Pull request `phase/4-routing-wiring` approved and merged.

---

### Milestone 5 — Hardening and Polish *(Phase 4–5 work)*

**Exit Criteria**:
- TD-08: `alert()`/`confirm()` replaced with inline toast notification component
- TD-10: Telegram connection drop detected and surfaced in UI with a reconnect prompt
- TD-02 fully resolved: all API error paths display user-readable messages in the auth screen and gallery screen
- Lighthouse CI baseline score established (Performance, Accessibility, Best Practices)
- Virtual scrolling evaluated; decision documented with evidence (accepted or deferred with threshold)
- Service worker / PWA manifest evaluated; decision documented

**Deliverable**: Pull request `phase/5-hardening` approved and merged. **GA-ready release.**

---

## 9. High-Level Timeline

> Calendar estimates assume one developer working part-time (approximately 10–15 focused hours per week). Adjust scale factors for team size.

```
Week  1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16
      ├───────────────┤
      Phase 1: Foundation
      [Wave 1: utils, settings, cache]
      CI setup
      TypeScript config
                      M1─┤
                      ├───────────────┤
                      Phase 2: API Boundary
                      [Wave 2: auth, dialogs]
                      GramJS mock layer
                                      M2─┤
                                      ├───────────────────┤
                                      Phase 3: UX Core
                                      [Wave 3: gallery, viewer]
                                      Regression testing
                                                          M3─┤
                                                          ├───────┤
                                                          Phase 4: Routing
                                                          E2E tests
                                                                  M4─┤
                                                                  ├───────────┤
                                                                  Phase 5: Hardening
                                                                  Toasts, offline, audit
                                                                              M5─┤
```

| Phase | Start | End | Duration | Gate |
|-------|-------|-----|----------|------|
| Phase 1 — Foundation | Week 1 | Week 4 | 4 weeks | Milestone 1 |
| Phase 2 — API Boundary | Week 4 | Week 8 | 4 weeks | Milestone 2 |
| Phase 3 — UX Core | Week 8 | Week 12 | 4 weeks | Milestone 3 *(first deployable)* |
| Phase 4 — Routing | Week 12 | Week 14 | 2 weeks | Milestone 4 |
| Phase 5 — Hardening | Week 14 | Week 16 | 2 weeks | Milestone 5 *(GA)* |
| **Total** | | | **16 weeks** | |

**Buffer**: Two float weeks are held in reserve after Milestone 5 for stakeholder acceptance testing and any discovered regressions before formal release.

---

## 10. Risk Register and Mitigation

### Risk Matrix

| ID | Risk | Likelihood | Impact | Score | Mitigation |
|----|------|:---:|:---:|:---:|-----------|
| R-01 | GramJS API response types diverge from TypeScript interfaces | High | High | **9** | Define all GramJS types defensively with runtime validation guards; never trust raw response shape |
| R-02 | ES module `export let` binding for `client` is stale in consuming modules | High | High | **9** | Replace exported `let client` with a `getClient()` accessor function; eliminates binding capture issues |
| R-03 | IndexedDB schema version incompatibility after migration | Medium | High | **6** | Increment DB version to 2; implement `onupgradeneeded` migration path preserving existing records |
| R-04 | Telegram MTProto session string format changes between GramJS versions | Low | High | **4** | Pin GramJS to `2.26.22` throughout migration; document upgrade as a separate post-GA task |
| R-05 | Circular dependency introduced between `gallery` and `viewer` | Medium | Medium | **4** | Enforce dependency rule via ESLint `import/no-cycle` rule in CI; no exceptions |
| R-06 | `IntersectionObserver` behaviour differs across test environments | Medium | Medium | **4** | Mock `IntersectionObserver` in Vitest; test observer logic through public API (items appear in viewport) |
| R-07 | TypeScript strict mode reveals latent bugs in business logic | Medium | Medium | **4** | Treat as an opportunity, not a risk; allocate one sprint buffer for type-error triage |
| R-08 | Dialog pagination API behaves differently for channels vs groups | Medium | Low | **2** | Verify `getDialogs` continuation token with both entity types during Phase 2 manual testing |
| R-09 | Performance regression from module splitting (additional HTTP requests) | Low | Low | **1** | Vite bundles all imports at build time; module splitting has zero runtime cost in production |

### R-01 and R-02 Deep Dive (Highest Severity)

**R-01 — GramJS Type Safety**

GramJS has incomplete TypeScript typings. The strategy is:

1. Define local wrapper interfaces for every GramJS response used in the codebase (see `kilo-dev-process.md § 3.2` for the complete list of GramJS calls).
2. Create a `src/types/telegram.d.ts` ambient declaration file that augments GramJS types where they are missing or overly broad.
3. Use `as unknown as T` type assertions only in dedicated adapter functions, never inline.
4. Add runtime shape validation (type guard functions) for all GramJS response objects before they enter application state.

**R-02 — `client` Export Binding**

Named `export let` in ES modules creates a live binding in the exporting module but consuming modules receive the initial value. When `client` is reassigned during auth, consuming modules (dialogs, gallery, viewer) will reference `null` unless they call the exporting module's getter.

**Resolution**: Replace `export let client` with:

```typescript
// auth/index.ts
let _client: TelegramClient | null = null;

export function getClient(): TelegramClient {
  if (!_client) throw new Error('TelegramClient not initialised — call reconnect() first');
  return _client;
}

export function isConnected(): boolean {
  return _client !== null;
}
```

All consuming modules call `getClient()` at the point of use, guaranteeing they always receive the current reference.

---

## 11. Definition of Done

A module is **Done** when all of the following are true:

- [ ] Implementation in `src/<module>/index.ts` matches the acceptance criteria in § 6
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] ESLint reports zero errors and zero warnings
- [ ] All tests for the module pass
- [ ] Coverage thresholds for the phase are met
- [ ] No `console.log`, `alert()`, or `confirm()` calls present (Phases 1–4)
- [ ] All `URL.createObjectURL()` calls paired with a corresponding `URL.revokeObjectURL()` call
- [ ] `window.*` global assignments limited to debug helpers exposed explicitly in `main.ts`
- [ ] The corresponding technical debt items listed in § 3.3 are verified resolved
- [ ] A human reviewer has approved the pull request
- [ ] The module is merged to `main` via squash merge

A **Phase** is Done when all of its modules satisfy the above and the integration regression checklist passes:

**Integration Regression Checklist** (manual, performed on Chrome desktop + mobile Safari):

1. [ ] Fresh page load → auth screen displayed
2. [ ] Enter credentials → code sent, code input appears
3. [ ] Enter code → galleries screen displayed
4. [ ] Reload → auto-reconnect succeeds without entering credentials again
5. [ ] Browse Groups tab → all dialogs displayed (test with account >100 dialogs, Phase 2+)
6. [ ] Add group to gallery → appears in My Galleries tab
7. [ ] Remove group from gallery → removed from My Galleries tab
8. [ ] Open gallery → photo grid loads with thumbnails
9. [ ] Scroll to bottom → next chunk loads automatically
10. [ ] Click thumbnail → fullscreen viewer opens, thumbnail shown immediately, full quality loads
11. [ ] Press ← / → arrow keys → navigates between images
12. [ ] Press Escape → viewer closes
13. [ ] Click download button → file downloads with correct filename
14. [ ] Navigate to `#/gallery/:id` in URL bar → correct gallery opens
15. [ ] Navigate to `#/gallery/:id/:msgId` → correct gallery + fullscreen opens
16. [ ] Browser back button → returns to previous view
17. [ ] Settings tab → cache statistics display correctly
18. [ ] Clear cache → cache empties, statistics update
19. [ ] Logout → auth screen shown, localStorage cleared
20. [ ] Large file item (>100MB) → preview card shown, "Download to view" button works

---

## 12. Stakeholder Review Notes

This document is a **draft** and requires review before finalisation into the Executive Implementation Plan. The following sections are specifically flagged for stakeholder input:

### 12.1 Decisions Requiring Sign-Off

| # | Decision | Options | Recommendation |
|---|----------|---------|---------------|
| D-01 | TypeScript adoption scope | (a) Full strict TypeScript, (b) JSDoc type annotations only, (c) No types | (a) Full TypeScript — enables IDE-level safety and removes an entire class of runtime errors |
| D-02 | Dialog pagination limit | (a) Remove 100-dialog limit (paginate fully), (b) Raise to 500, (c) Keep 100 with filter UX | (a) Remove limit — technically straightforward and directly removes a usability constraint |
| D-03 | Toast notification implementation | (a) Build custom toast component, (b) Use a lightweight library (e.g., Sonner, notyf), (c) Keep alert() | (b) Lightweight library — avoids reinventing the wheel; adds ~2KB |
| D-04 | Virtual scrolling for large galleries | (a) Implement now (Phase 3), (b) Defer until threshold hit (>1000 items measured), (c) Accept current behaviour | (b) Defer — measure first; current IntersectionObserver approach handles up to ~500 items acceptably |
| D-05 | Service worker / offline support | (a) Add service worker in Phase 5, (b) Defer to post-GA, (c) Out of scope | (b) Defer — requires careful cache strategy that overlaps with IndexedDB; separate track recommended |
| D-06 | Component framework adoption | (a) Introduce Preact/Solid, (b) Use Web Components, (c) Stay vanilla | (c) Stay vanilla — framework complexity not justified by current feature set; revisit at GA+1 |

### 12.2 Assumptions

The following assumptions have been made in this plan. Stakeholders should confirm or correct:

1. The developer environment has access to a Telegram account for end-to-end testing in Phases 2–5.
2. GramJS `^2.26.22` does not need to be upgraded during this migration.
3. The production deployment target is a static web host (no server-side rendering, no API proxy).
4. Browser support target is the last two major versions of Chrome, Firefox, and Safari (ES2022 features available).
5. There is no requirement to support Internet Explorer or legacy Chromium-based browsers.

### 12.3 Items Not Yet Decided

- Whether a `CHANGELOG.md` should be maintained and by whom
- Whether automated visual regression testing (e.g., Percy, Chromatic) is in scope
- Release naming convention (semantic versioning vs date-based)
- Whether the `telegram-gallery.code-workspace` VS Code file should be replaced with a `.vscode/settings.json` standardised across editors

---

## 13. Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|------------------|
| Q-01 | Does GramJS `getDialogs()` support cursor-based continuation for >100 dialogs without re-fetching all? | Engineering | Phase 2 kickoff |
| Q-02 | What is the largest real-world gallery size observed in production (photo count)? Informs virtual scrolling decision. | Product | Milestone 3 gate |
| Q-03 | Should `galleryIds` be synced across browser sessions (e.g., via Telegram Saved Messages as storage)? | Product | Post-GA backlog or D-06 discussion |
| Q-04 | Is there a requirement for the app to be installable as a PWA (Add to Home Screen)? | Product | Milestone 5 gate |
| Q-05 | Should the `window.getCacheStats` / `window.clearCache` debug console API be retained in production builds or gated by a debug flag? | Engineering | Phase 1 kickoff |

---

*This document is a draft prepared for stakeholder review. It is not yet approved for use as the authoritative Executive Implementation Plan. No development work should begin based solely on this document until the sign-off gates in § 12.1 are resolved and the final version is ratified.*

---

**Revision History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-04-09 | Solutions Architecture | Initial draft |
