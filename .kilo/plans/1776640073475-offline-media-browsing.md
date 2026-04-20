# Offline‑Media Browsing – Background Sync & Pre‑fetching

**Goal:** Implement background sync for uploads and pre‑fetching of media for offline browsing, enhancing the current offline capabilities beyond app‑shell precache and cached viewer support.

**Plan ID:** 1776640073475‑offline‑media‑browsing  
**Created:** 2026‑04‑20 01:54:56 +02:00  
**Status:** pending  

## Overview

The repository currently supports:
- App‑shell precache (service worker)
- Dialog snapshot bootstrap (offline dialog list)
- Cached thumbnail reuse (in‑session)
- Cached full‑media viewer support (OPFS + IndexedDB fallback)
- Offline action guards (disable download/forward/share when offline)

Missing broader offline‑media behavior:
1. **Background sync for uploads** – store upload requests when offline, retry when online.
2. **Pre‑fetching** – allow user to mark dialogs for offline, download all media in background.
3. **Enhanced cache management** – UI to view cache usage, clear by age/size/type.
4. **Offline search** – search within cached media metadata.

This plan implements the first two high‑value features (background sync + pre‑fetching). Enhanced cache management and offline search are deferred to a later iteration.

## Prerequisites

- Read `APPLICATION_SPEC.md` to understand current offline capabilities.
- Examine `public/sw.js` (service worker) and `src/lib/cache/` modules.
- Review existing offline guards in `src/components/gallery/utils/bulk‑actions.ts`.
- Understand IndexedDB schema (`src/lib/cache/indexeddb.ts`) and OPFS storage (`src/lib/cache/opfs.ts`).

## Execution Order

### Phase 1: Background Sync for Uploads

**Objective:** Store upload requests when offline and automatically retry when connectivity returns.

**Steps:**

1. **Extend IndexedDB schema** – add `uploadQueue` store with fields:
   - `id` (auto‑increment)
   - `dialogId` (string)
   - `file` (serialized File/Blob as ArrayBuffer + metadata)
   - `createdAt` (timestamp)
   - `retryCount` (number)
   - `lastError` (string | null)

2. **Create upload‑queue module** (`src/lib/upload/queue.ts`):
   - `enqueueUpload(dialogId: string, file: File): Promise<void>` – stores request in IndexedDB.
   - `processQueue(): Promise<void>` – processes pending uploads when online.
   - `getPendingCount(): Promise<number>` – returns count of pending uploads.

3. **Modify upload adapter** (`src/lib/telegram/mtcute.ts`):
   - When offline, call `enqueueUpload` instead of immediate upload.
   - Show toast: “Upload queued; will send when online.”

4. **Update service worker** (`public/sw.js`):
   - Add `sync` event listener for `'upload-queue'` tag.
   - In `sync` handler, fetch pending uploads from IndexedDB (via `postMessage` to client) and attempt upload.
   - On success, remove from queue; on failure, increment retry count (max 3).

5. **Register sync tag** in client code when queue is non‑empty:
   ```ts
   if ('serviceWorker' in navigator && 'SyncManager' in window) {
     const reg = await navigator.serviceWorker.ready
     await reg.sync.register('upload-queue')
   }
   ```

6. **UI feedback** – show badge in header when uploads are pending; add a “Pending uploads” panel in settings.

**Validation:**
- Type check passes.
- Short test suite passes (mock offline scenario).
- Manual test: upload while offline → request stored; go online → upload completes.

### Phase 2: Pre‑fetching UI and Background Download

**Objective:** Allow user to mark a dialog for offline, download all media in background, track progress, manage storage.

**Steps:**

1. **Extend IndexedDB schema** – add `prefetchQueue` store:
   - `dialogId` (string, unique)
   - `status` ('pending' | 'downloading' | 'completed' | 'failed')
   - `totalItems` (number)
   - `processedItems` (number)
   - `startedAt` (timestamp)
   - `completedAt` (timestamp | null)
   - `error` (string | null)

2. **Create pre‑fetch module** (`src/lib/cache/prefetch.ts`):
   - `markDialogForOffline(dialogId: string): Promise<void>` – adds entry to queue.
   - `startPrefetchWorker(): Promise<void>` – background worker that processes queue.
   - `getPrefetchStatus(dialogId: string): Promise<PrefetchStatus>` – returns current status.
   - `cancelPrefetch(dialogId: string): Promise<void>` – removes from queue and stops downloads.

3. **UI additions**:
   - **Dialog list**: add “Download for offline” button next to each dialog (only when online).
   - **Settings panel**: new section “Offline Dialogs” showing status of each prefetch (progress bar, cancel button).
   - **Storage warning**: show warning when cache usage exceeds quota (e.g., >80%).

4. **Background download logic**:
   - Use existing `downloadFull` adapter method.
   - Store downloaded media in OPFS/IndexedDB via existing cache APIs.
   - Throttle concurrent downloads (max 2) to avoid overwhelming network.
   - Respect `navigator.onLine` changes; pause when offline, resume when online.

5. **Progress reporting** – update `prefetchQueue` store periodically; notify UI via store subscription.

**Validation:**
- Type check passes.
- Short test suite passes (mock prefetch flow).
- Manual test: mark dialog → see progress in settings → verify media available offline.

### Phase 3: Enhanced Cache Management UI

**Objective:** Provide UI to view cache usage and clear cached media by criteria.

**Steps:**

1. **Extend cache info API** (`src/lib/cache/opfs.ts`):
   - `getCacheUsage(): Promise<{ totalBytes: number; itemCount: number; byType: Record<string, number> }>`
   - `clearCacheByAge(maxAgeMs: number): Promise<number>` – removes entries older than threshold.
   - `clearCacheByType(mediaType: string): Promise<number>` – removes entries of given type.

2. **Add settings UI** (`src/components/settings/SettingsScreen.svelte`):
   - New section “Cache Management”.
   - Show total cache size, breakdown by media type.
   - Buttons: “Clear all cached media”, “Clear older than 1 week”, “Clear videos only”.
   - Confirmation dialogs before destructive actions.

3. **Integrate with pre‑fetch** – when cache is cleared, update prefetch status accordingly.

**Validation:**
- Type check passes.
- Manual test: verify cache usage displayed, clearing works, prefetch status updated.

### Phase 4: Offline Search

**Objective:** Enable search within cached media metadata (filename, date, sender).

**Steps:**

1. **Extend IndexedDB schema** – add `searchIndex` store:
   - `mediaId` (string, foreign key)
   - `dialogId` (string)
   - `filename` (string)
   - `date` (timestamp)
   - `sender` (string | null)
   - `type` (string)

2. **Create search indexer** (`src/lib/search/offline.ts`):
   - `indexMediaItem(item: MediaItem): Promise<void>` – adds/updates entry.
   - `search(query: string, dialogId?: string): Promise<MediaItem[]>` – performs full‑text search on filename/sender.

3. **Hook into cache writes** – when media is cached (via download or prefetch), automatically index it.

4. **Add offline search UI** – in gallery header, show search box that works offline; filter results to cached items only.

5. **Fallback behavior** – when online, fall back to existing Telegram search.

**Validation:**
- Type check passes.
- Manual test: cache some media, go offline, search by filename → results appear.

### Phase 5: Validation and Integration

**Objective:** Ensure all new features work together and do not break existing functionality.

**Steps:**

1. **Run comprehensive tests**:
   - Type check: `npm run check`
   - Short test suite: `npm run test:short`
   - Long test suite: `npm run test:long` (focus on offline flows)

2. **Update documentation**:
   - `APPLICATION_SPEC.md` – mark background sync and pre‑fetching as implemented.
   - `STATUS.md` – record completion of each phase.

3. **Commit discipline** – each phase is a separate commit with conventional commit message.

## Success Criteria

- **Background sync**: uploads queued offline are automatically sent when online; user receives feedback.
- **Pre‑fetching**: user can mark dialog for offline, see progress, and browse cached media offline.
- **Cache management**: user can view cache usage and clear by criteria.
- **Offline search**: user can search cached media metadata while offline.
- **No regression**: existing offline capabilities (app‑shell, dialog snapshot, cached viewer) continue to work.
- **Type safety**: zero TypeScript errors.
- **Test coverage**: all existing Playwright tests pass.

## Files to Modify

**New files:**
- `src/lib/upload/queue.ts`
- `src/lib/cache/prefetch.ts`
- `src/lib/search/offline.ts`
- `src/components/settings/CacheManagement.svelte`
- `src/components/dialogs/OfflineDialogButton.svelte`

**Modified files:**
- `public/sw.js` (add sync event)
- `src/lib/cache/indexeddb.ts` (extend schema)
- `src/lib/cache/opfs.ts` (add cache‑usage APIs)
- `src/lib/telegram/mtcute.ts` (upload offline handling)
- `src/components/settings/SettingsScreen.svelte` (add cache management UI)
- `src/components/dialogs/DialogItem.svelte` (add offline button)
- `src/components/gallery/GalleryHeader.svelte` (add offline search box)
- `STATUS.md` (update todo states)
- `APPLICATION_SPEC.md` (update supported behavior)

**No changes required in:**
- `AGENTS.md`
- `TESTING_STRATEGY.md`
- Existing adapter interface (`src/lib/telegram/adapter.ts`)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Background sync not supported in all browsers | Feature‑detect `SyncManager`; fallback to periodic retry via `setInterval`. |
| OPFS storage quota exceeded | Monitor quota usage; warn user; provide clear‑cache options. |
| Pre‑fetching large dialogs may take hours | Show realistic progress; allow pausing/cancellation; background worker can run across sessions. |
| IndexedDB schema migration | Use versioned upgrades; preserve existing data. |
| Service worker update may break existing offline shell | Keep cache‑versioning explicit; test production build. |

## Estimated Effort

- **Phase 1 (background sync)**: 3–4 hours
- **Phase 2 (pre‑fetching)**: 4–5 hours  
- **Phase 3 (cache management UI)**: 2–3 hours
- **Phase 4 (offline search)**: 3–4 hours
- **Phase 5 (validation)**: 1–2 hours
- **Total**: ~13–18 hours

## Blockers

- None identified; all dependencies (IndexedDB, OPFS, service worker) are already in place.

## Notes

- Follow existing commit discipline: each phase is a logical block, validated before commit.
- Keep UI consistent with existing design (dark theme, Telegram blue accent).
- Ensure all new features are accessible (ARIA labels, keyboard navigation).
- Update `STATUS.md` after each phase completion.
- This plan implements the “broader service‑worker/offline media behavior” mentioned in `APPLICATION_SPEC.md`.