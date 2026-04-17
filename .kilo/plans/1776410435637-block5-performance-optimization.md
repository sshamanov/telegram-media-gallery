# Block 5: Performance Optimization Implementation Plan

> **Status:** active
> **Date:** 2026-04-17
> **Based on:** Clever Island plan Block 5 requirements
> **Parent Plan:** `.kilo/plans/1776410435637-clever-island.md`

---

## Executive Summary

Block 5 focuses on measurable performance improvements after the feature surface stabilized in Blocks 2-4. The work is organized around three evidence-driven optimization tracks: reducing shipped JavaScript/CSS, improving download throughput and queue responsiveness, and lowering memory pressure during gallery and viewer usage. The block starts with instrumentation so every later change is justified by baseline data, then lands targeted optimizations in the hottest paths already identified by earlier work (`src/lib/files.ts`, `src/stores/gallery.ts`, `src/components/gallery/ViewerWrapper.svelte`, and the app shell/bundle entrypoints).

The goal is not speculative micro-optimization. Each task must produce before/after evidence, preserve the current supported behavior in `APPLICATION_SPEC.md`, and avoid regressions in gallery, viewer, offline cache, and Phase 2 action flows.

## Block 5 Tasks

### Task 66: Analyze Bottlenecks
**Goal:** Establish an evidence-backed baseline for bundle size, download behavior, and runtime memory before changing implementation.

**Implementation Details:**
1. **Review prior download findings:**
   - Re-read earlier speed-investigation notes already reflected in `STATUS.md` (buffer copy removal, progress throttling).
   - Identify remaining hotspots in bulk download flow: serialized queue behavior, cache writes, adapter progress cadence, and blob save timing.
   - Record hypotheses for each remaining bottleneck so later changes can be matched to observed pain points.

2. **Generate bundle analysis:**
   - Add a temporary or committed Vite build analysis path if needed (for example `vite build --report` or a Rollup visualizer plugin only if it can be justified and kept lightweight).
   - Produce a before snapshot of main bundle composition: Svelte app shell, PhotoSwipe, QR/auth code, cache code, and settings/viewer code.
   - Identify chunk boundaries that are currently missing: viewer-only dependencies, auth-only dependencies, settings-only code, and utility code imported into the root app shell.

3. **Profile memory behavior:**
   - Inspect hot paths for repeated allocations during gallery scrolling and viewer open/close cycles.
   - Focus on object URL lifecycle, repeated array rebuilding in stores, large blob retention, and event-listener cleanup.
   - Use browser profiling/manual instrumentation to capture stable scenarios: initial gallery load, repeated viewer navigation, and a bulk download run.

4. **Document the optimization backlog:**
   - Convert findings into a short ranked list of changes with expected impact and risk.
   - Separate required fixes from stretch work (virtual scrolling stays stretch-only unless profiling proves it necessary).

**Files:**
- `package.json` - add/report bundle analysis script if needed
- `vite.config.ts` - enable bundle report path if needed
- `src/stores/gallery.ts` - inspect queue and derived-state hotspots
- `src/lib/files.ts` - inspect download/cache path allocations
- `src/components/gallery/ViewerWrapper.svelte` - inspect blob/object URL lifecycle
- `STATUS.md` - record baseline metrics and validation evidence

### Task 67: Bundle Size Reduction
**Goal:** Reduce initial bundle cost without removing supported functionality.

**Implementation Details:**
1. **Route/component code splitting:**
   - Audit eager imports in `src/App.svelte`, `src/main.ts`, and route/render entrypoints.
   - Lazy-load heavy screen-level modules where acceptable: settings screen, viewer wrapper, desktop-only sidebar/layout helpers, and QR/auth helpers if they are not needed after session restore.
   - Ensure loading states remain truthful and do not break existing route/viewer behavior.

2. **Dependency and import cleanup:**
   - Verify whether any current dependency or helper is only used in narrow flows and can move behind dynamic import boundaries.
   - Remove dead code or duplicate utilities discovered during bundle review.
   - Keep adapter boundaries intact; no feature code may import `@mtcute/web` directly.

3. **Asset and CSS loading optimization:**
   - Review whether PhotoSwipe styles, viewer-only styling, and optional desktop/masonry helpers can be deferred or scoped more narrowly.
   - Avoid shipping non-critical code for offline/cache/settings flows on first paint where a later load is acceptable.
   - Preserve PWA shell correctness and service-worker asset coverage.

4. **Rebuild and compare:**
   - Re-run the bundle report and compare initial chunk sizes against the baseline from Task 66.
   - Record net savings and note any accepted trade-offs such as one-time lazy-load latency.

**Files:**
- `src/App.svelte` - route-level and screen-level import boundaries
- `src/main.ts` - startup import path review
- `src/components/gallery/ViewerWrapper.svelte` - candidate for lazy loading boundary
- `src/components/settings/SettingsScreen.svelte` and/or `src/components/settings/SettingsPanel.svelte` - candidate for deferred loading
- `src/components/auth/AuthScreen.svelte` / `src/components/auth/QRForm.svelte` - candidate for auth-flow-only chunking
- `src/app.css` - review viewer/settings/desktop CSS loading strategy
- `vite.config.ts` - chunk naming/manual chunk configuration if needed
- `package.json` - bundle analysis/build scripts if kept

### Task 68: Download Optimizations
**Goal:** Improve bulk download throughput and queue responsiveness while keeping progress feedback clear and truthful.

**Implementation Details:**
1. **Parallelize download queue safely:**
   - Replace purely serialized bulk download processing with bounded concurrency (target starting point: 2-3 simultaneous downloads, tunable if profiling requires).
   - Keep queue ordering deterministic in UI state even when underlying downloads complete out of order.
   - Prevent memory spikes by avoiding unbounded blob accumulation; persist/save each file as soon as possible.

2. **Refine progress reporting:**
   - Preserve existing throttling benefits but improve queue-level progress semantics.
   - Track both per-item progress and aggregate queue progress so the UI reflects active work, completed count, retries, and wait states accurately.
   - Ensure progress updates do not trigger excessive store churn or jank.

3. **Adapter/download path review:**
   - Review `TelegramAdapter.downloadFull` call path and mtcute implementation for extra copies, unnecessary buffering, or retry inefficiencies.
   - Keep all Telegram interaction changes inside adapter implementations and `src/lib/files.ts`.
   - If compression is explored, treat it as conditional research only: Telegram payload compression is unlikely to be controllable client-side, so the practical optimization may instead be reducing redundant writes/copies. Do not claim network compression support unless the implementation is real and measurable.

4. **Error handling and backpressure:**
   - Preserve flood-wait handling and abort behavior under parallel execution.
   - Add queue safeguards so one failed item does not stall the whole batch.
   - Ensure offline guards and disabled states remain accurate.

**Files:**
- `src/stores/gallery.ts` - bulk download queue orchestration, state, aggregate progress
- `src/lib/files.ts` - cached/full download helpers, save flow, throttling, backpressure
- `src/lib/telegram/adapter.ts` - adapter contract review only if progress semantics need extension
- `src/lib/telegram/mtcute.ts` - real download implementation tuning
- `src/lib/telegram/mock.ts` - keep mock progress behavior aligned with queue expectations
- `src/types/telegram.ts` - queue/progress type updates if needed
- `src/components/gallery/SelectionToolbar.svelte` and related download UI components - progress wording/UI if state shape changes
- `STATUS.md` - record before/after measurements and validation evidence

### Task 69: Memory Efficiency
**Goal:** Reduce avoidable allocations and ensure gallery/viewer flows release resources promptly.

**Implementation Details:**
1. **Review hot-path allocations:**
   - Audit repeated array/object creation in derived stores and load/append paths.
   - Inspect whether large media collections are copied more often than necessary during filtering, selection updates, and viewer synchronization.
   - Identify low-risk memoization or structural reuse opportunities.

2. **Tighten cleanup behavior:**
   - Re-audit every `URL.createObjectURL()` call site and confirm matching `URL.revokeObjectURL()` behavior on replacement, slide change, close, and component destroy.
   - Verify event listeners, timers, swipe handlers, and PhotoSwipe subscriptions are always removed.
   - Ensure aborted downloads and failed viewer loads do not retain stale blobs, controllers, or DOM nodes.

3. **Viewer and gallery memory stabilization:**
   - Limit retained viewer artifacts when navigating across many items.
   - Review thumbnail/full-media caching interactions so in-memory retention does not duplicate persisted cache unnecessarily.
   - Consider reducing preloaded viewer payload size if profiling shows avoidable retention.

4. **Virtual scrolling stretch goal:**
   - Only pursue if Task 66 profiling shows DOM size or scroll memory is a real blocker for supported scenarios.
   - If needed, implement as an isolated follow-up inside `GalleryGrid` with explicit trade-off review for masonry/list/grid modes.
   - If not justified, document deferral instead of forcing complexity into this block.

**Files:**
- `src/components/gallery/ViewerWrapper.svelte` - object URL, DOM, and PhotoSwipe cleanup
- `src/components/gallery/GalleryGrid.svelte` - DOM/rendering pressure review; virtual scrolling stretch target
- `src/components/gallery/MediaItem.svelte` - thumbnail/object URL lifecycle review if needed
- `src/components/gallery/MediaListRow.svelte` - row rendering/object reuse review if needed
- `src/stores/gallery.ts` - array churn, selection/filter/viewer synchronization
- `src/lib/dom/swipe-gestures.ts` - listener cleanup verification
- `src/lib/dom/pull-to-refresh.ts` - listener/timer cleanup verification
- `src/lib/events.ts` - event subscription cleanup review if involved
- `STATUS.md` - record memory findings, fixes, and any virtual-scroll deferral

### Task 70: Validation
**Goal:** Prove measurable gains, stable memory behavior, and zero product regression after optimization work.

**Implementation Details:**
1. **Static/build validation:**
   - `docker run --rm --network host -v "$(pwd)":/app -w /app node:24-alpine npm run check`
   - `docker run --rm --network host -v "$(pwd)":/app -w /app node:24-alpine npm run build`
   - Bundle report regenerated and attached to the ledger summary.

2. **Required product validation:**
   - `docker-compose -f docker-compose.test.yml up --build playwright`
   - Confirm no regressions in auth baseline, dialog navigation, gallery baseline, viewer baseline, settings, and offline guards.

3. **Performance validation:**
   - Compare before/after initial bundle size and main chunk size.
   - Compare bulk download timings using the same sample set and environment assumptions.
   - Run a repeatable viewer/gallery memory scenario and confirm no uncontrolled growth across cycles.

4. **Documentation and ledger closure:**
   - Update `STATUS.md` with the exact metrics, pass/fail results, any deferred optimization (such as virtual scrolling), and commit hashes for each logical block.
   - Update `APPLICATION_SPEC.md` only if supported runtime behavior or accepted limitations changed.

## Implementation Order

1. **Baseline first** (Task 66): no optimization lands before metrics exist.
2. **Smallest-risk wins** (Task 67): bundle cleanup/code splitting first because it is easy to measure and easy to isolate.
3. **Hot-path throughput next** (Task 68): queue and download improvements after the measurement baseline exists.
4. **Memory hardening** (Task 69): cleanup and retention fixes after throughput work settles.
5. **Final validation** (Task 70): rerun required checks, compare metrics, and close the block truthfully.

## Success Criteria

### Technical:
- Initial bundle/main entry size is reduced by a measurable amount relative to the Task 66 baseline.
- Bulk download flow completes faster or with visibly improved queue responsiveness under the same sample workload.
- Viewer/gallery memory behavior remains stable across repeated open/close/navigation cycles.
- `npm run check`, production build, and required Playwright validation all pass.
- No regression in offline guards, cache-backed viewer behavior, or Phase 2 action flows.

### User Experience:
- App feels faster to load on first visit due to reduced initial payload.
- Bulk download progress is clearer and more responsive.
- Extended browsing/viewer sessions do not visibly degrade due to retained resources.
- Any deferred stretch work is documented honestly instead of being implied as complete.

## Risks & Mitigations

1. **Lazy loading may cause UI flashes or route latency**
   - Mitigation: apply dynamic imports only at natural screen/viewer boundaries and provide explicit loading fallback where necessary.

2. **Parallel downloads may increase memory pressure or hit Telegram limits**
   - Mitigation: use bounded concurrency, keep flood-wait handling intact, and validate with realistic sample batches.

3. **Cleanup changes may break viewer/media rendering**
   - Mitigation: focus on lifecycle correctness, verify all object URL changes with repeated viewer navigation tests.

4. **Virtual scrolling may conflict with masonry/list/grid modes**
   - Mitigation: treat as stretch-only; defer unless profiling shows current supported scenarios need it.

## Dependencies

- **Block 4 completion:** feature scope is now stable enough to optimize without chasing moving UI targets.
- **Existing cache stack:** OPFS/IndexedDB behavior must remain unchanged unless explicitly re-documented.
- **Existing download pipeline:** improvements build on the current throttled progress and buffer-copy cleanup already recorded in `STATUS.md`.
- **Short test suite stability:** optimization work must preserve the currently accepted baseline surface.

## Validation Requirements

### Mandatory after each logical block:
- `docker run --rm --network host -v "$(pwd)":/app -w /app node:24-alpine npm run check`
- `docker-compose -f docker-compose.test.yml up --build playwright` whenever executable behavior, selectors/contracts, or tests change
- Update `STATUS.md` with block progress, validation result, deferral reason if any, and commit hash

### Mandatory for final Block 5 closure:
- Fresh bundle report with before/after comparison
- Production build succeeds
- Required short Playwright suite passes
- Memory and download measurements recorded in `STATUS.md`
- Working tree clean after final commit

## Estimated Effort

- **Task 66 (Analysis):** Medium (1.5-2.5 hours)
- **Task 67 (Bundle Reduction):** Medium (2-3 hours)
- **Task 68 (Download Optimization):** Medium-High (2.5-4 hours)
- **Task 69 (Memory Efficiency):** Medium (2-3.5 hours)
- **Task 70 (Validation):** Medium (1-1.5 hours)
- **Total:** ~9-14.5 hours

---

**Next Step:** Begin with Task 66 and capture a before baseline for bundle size, bulk download timing, and viewer/gallery memory behavior.

**Plan Reference:** This plan implements Block 5 of `.kilo/plans/1776410435637-clever-island.md`
