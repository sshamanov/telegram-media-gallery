# Phase 3 Kickoff Plan

## Goal
- Turn the roadmap Phase 3 scope into an execution-ready backlog for offline shell, cached bootstrap, and OPFS-backed media storage.
- Sequence the work so each block is independently committable, validated, and does not overclaim unsupported offline behavior before its prerequisites exist.

## Planning Inputs
- Roadmap source: `.kilo/plans/1775737553407-cosmic-engine.md` Part 7.
- Current groundwork already in repo:
  - `src/lib/cache/opfs.ts`
  - `src/lib/files.ts`
  - `src/App.svelte`
  - `src/components/gallery/ViewerWrapper.svelte`
  - `src/components/settings/SettingsPanel.svelte`
  - `src/main.ts`
- Current missing foundations:
  - `public/sw.js` is still a stub and does not precache the production app shell.
  - No production-mode Playwright path exists to validate service-worker behavior.
  - No persisted dialog snapshot exists for offline bootstrap.
  - OPFS migration and fallback semantics are incomplete.

## Execution Rules For This Plan
- Keep Phase 3 work split into one logical block per commit.
- Do not claim offline support in `APPLICATION_SPEC.md` until the corresponding block is implemented and validated.
- Run `docker run --rm --network host -v "$(pwd)":/app -w /app node:24-alpine npm run check` after every executable block.
- Run short and long Playwright coverage only when the touched block changes executable behavior or test contracts, using `docker-compose -f docker-compose.test.yml ...`.
- Use production-mode validation for service-worker/offline blocks; mock-mode dev-server checks are not sufficient for SW acceptance criteria.

## Ordered Backlog Blocks

### Block 1 - Real app-shell precache and production validation path
- Purpose: replace the current service-worker stub with a real production precache flow and establish a reproducible validation path for installed SW behavior.
- Dependencies: none; this is the Phase 3 entry gate.
- Planned files:
  - `public/sw.js`
  - `src/main.ts`
  - `vite.config.ts`
  - `package.json`
  - `playwright.config.ts`
  - `tests/e2e/shared/fixtures.ts`
  - `tests/e2e/long/offline.spec.ts` (new)
  - `docker-compose.test.yml`
  - `STATUS.md`
- Implementation notes:
  - Generate a real precache manifest for `/`, `/index.html`, and hashed JS/CSS assets during production build.
  - Keep cache versioning explicit and remove stale app-shell caches on activate.
  - Add a production-mode Playwright path that serves `dist/` and verifies SW registration plus offline shell bootstrap.
- Validation target:
  - `npm run check`
  - production build
  - dedicated Playwright run proving cached shell loads offline after one online visit.
- Exit criteria:
  - SW registration is real in production.
  - Offline app shell behavior is executable and testable.

### Block 2 - Persist dialog snapshot for offline bootstrap
- Purpose: allow dialog list boot to render last-known dialogs while offline instead of depending only on live fetch.
- Dependencies: Block 1.
- Planned files:
  - `src/stores/dialogs.ts`
  - `src/stores/persisted.ts`
  - `src/stores/telegram.ts`
  - `src/stores/ui.ts`
  - `src/App.svelte`
  - `src/components/dialogs/DialogList.svelte`
  - `src/components/ui/OfflineBanner.svelte`
  - `tests/e2e/short/dialogs.spec.ts`
  - `tests/e2e/long/offline.spec.ts`
  - `APPLICATION_SPEC.md`
  - `STATUS.md`
- Implementation notes:
  - Persist a sanitized last-known dialog snapshot separate from bookmark-only state.
  - Use the snapshot only for offline bootstrap and silent reconnect recovery.
  - Define stale/empty snapshot behavior explicitly so the UI does not imply live freshness.
- Validation target:
  - `npm run check`
  - short dialogs coverage update if selectors or bootstrap behavior changes
  - long offline coverage proving dialog list renders from persisted snapshot.
- Exit criteria:
  - Offline dialog list uses persisted data truthfully.
  - Restore path refreshes live data when connectivity returns.

### Block 3 - Harden OPFS migration and fallback behavior
- Purpose: make full-media storage migration resumable, observable, and safe on browsers without usable OPFS.
- Dependencies: Block 2.
- Planned files:
  - `src/lib/cache/opfs.ts`
  - `src/lib/cache/indexeddb.ts`
  - `src/lib/cache/storage-usage.ts`
  - `src/lib/files.ts`
  - `src/stores/settings.ts`
  - `src/components/ui/MigrationScreen.svelte`
  - `src/components/settings/SettingsPanel.svelte`
  - `tests/e2e/long/cache.spec.ts`
  - `APPLICATION_SPEC.md`
  - `STATUS.md`
- Implementation notes:
  - Define one-time migration state, resumability, partial-failure handling, and IndexedDB fallback when OPFS is unavailable.
  - Keep storage reporting aligned with real cache locations.
  - Avoid silent downgrade paths; settings copy must reflect the actual backend in use.
- Validation target:
  - `npm run check`
  - long cache coverage for migration/fallback/storage reporting behavior.
- Exit criteria:
  - Migration semantics are deterministic.
  - Browsers without OPFS continue to function without false OPFS claims.

### Block 4 - Align offline thumbnail and full-media behavior with actual cache architecture
- Purpose: make offline gallery/viewer behavior match the implemented cache layers instead of the aspirational roadmap wording.
- Dependencies: Blocks 1-3.
- Planned files:
  - `src/lib/files.ts`
  - `src/lib/thumbnails.ts`
  - `src/stores/gallery.ts`
  - `src/components/gallery/GalleryGrid.svelte`
  - `src/components/gallery/ViewerWrapper.svelte`
  - `src/components/ui/CacheIndicator.svelte`
  - `tests/e2e/short/gallery.spec.ts`
  - `tests/e2e/short/viewer.spec.ts`
  - `tests/e2e/long/offline.spec.ts`
  - `APPLICATION_SPEC.md`
  - `STATUS.md`
- Implementation notes:
  - Make thumbnail offline behavior consistent with IndexedDB plus SW cache responsibilities.
  - Ensure uncached full media produces the existing offline placeholder path rather than broken loads.
  - Keep object URL lifecycle correct for cached media loads.
- Validation target:
  - `npm run check`
  - short gallery/viewer updates if baseline selectors or behavior changes
  - long offline coverage for cached vs uncached media behavior.
- Exit criteria:
  - Offline placeholder behavior matches real cache availability.
  - Docs can describe thumbnail/full-media offline behavior without speculation.

### Block 5 - Finish offline action guards and Phase 3 coverage
- Purpose: close the remaining user-action and acceptance-coverage gaps after the storage/offline foundations land.
- Dependencies: Blocks 1-4.
- Planned files:
  - `src/stores/ui.ts`
  - `src/stores/gallery.ts`
  - `src/components/gallery/ViewerWrapper.svelte`
  - `src/components/gallery/DialogPicker.svelte`
  - `src/components/settings/SettingsPanel.svelte`
  - `tests/e2e/long/offline.spec.ts`
  - `tests/e2e/long/cache.spec.ts`
  - `APPLICATION_SPEC.md`
  - `STATUS.md`
- Implementation notes:
  - Disable or guard download, forward, and share actions while offline based on real cache/connectivity state.
  - Reconcile any remaining status/spec wording with the final supported Phase 3 surface.
  - Close the Phase 3 acceptance matrix only after executable assertions exist.
- Validation target:
  - `npm run check`
  - required short suite if baseline UI contracts changed
  - long offline/cache coverage for all accepted Phase 3 behaviors.
- Exit criteria:
  - Offline-only guards match shipped behavior.
  - Phase 3 claims are backed by automated validation.

## Dependency Summary
- Block 1 is the hard prerequisite for all offline acceptance work.
- Block 2 must land before truthful offline dialog bootstrap claims.
- Block 3 must land before storage migration can be considered supported.
- Block 4 depends on Blocks 1-3 because runtime offline media behavior must reflect both SW and storage realities.
- Block 5 closes acceptance only after the prior runtime behavior exists.

## Phase 3 Validation Matrix
- Block 1: type check + build + production-mode offline shell Playwright validation.
- Block 2: type check + dialogs/offline Playwright validation.
- Block 3: type check + cache/migration Playwright validation.
- Block 4: type check + gallery/viewer offline Playwright validation.
- Block 5: type check + final offline/cache regression coverage for accepted Phase 3 behavior.

## First Implementation Block
- Start with Block 1: real app-shell service-worker precache and production-mode validation path.
