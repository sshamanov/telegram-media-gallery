# Task 9: Refactor Large Modules

**Goal:** Split four large files (`mtcute.ts`, `mock.ts`, `GalleryGrid.svelte`, `ViewerWrapper.svelte`) into smaller, focused modules to improve maintainability and testability.

**Plan ID:** 1776540483163-task9-refactor-large-modules  
**Created:** 2026-04-18 21:28:03 +02:00  
**Status:** partially_completed  

## Overview

The codebase contains several files exceeding 400 lines, which makes navigation and testing difficult. This task will:

1. **Analyze** each target file to identify logical seams.
2. **Extract** helper functions, constants, and sub‑components into separate files.
3. **Preserve** existing public interfaces – no change in external behavior.
4. **Validate** that all existing functionality works unchanged.

## Execution Order

### Phase 0: Analysis & Planning
1. Examine each target file, noting exports, imports, and internal dependencies.
2. Identify extraction candidates (pure functions, constants, internal types, reusable UI blocks).
3. Decide on new file names and locations.

### Phase 1: Refactor `src/lib/telegram/mtcute.ts` (457 lines)
- Extract pure helper functions (`errorMessage`, `isPasswordRequired`, `documentDimensions`, `documentDuration`, `fileLikeName`, `mapPeer`, `mapMessage`, `downloadMedia`).
- Move constants (size limits, default delays) to a separate module.
- Keep the `MtcuteAdapter` class intact; import extracted helpers.

### Phase 2: Refactor `src/lib/telegram/mock.ts` (457 lines)
- Extract sample data loading (`loadDialogs`, `loadMedia`, `loadMessages`) to `mock-data.ts`.
- Extract artificial delay simulation to `mock-delay.ts`.
- Extract cache‑first logic (already shared with mtcute) to a shared utility.
- Keep the `MockAdapter` class; import extracted modules.

### Phase 3: Refactor `src/components/gallery/GalleryGrid.svelte` (~500 lines)
- Extract masonry layout CSS and detection logic to `masonry.ts`.
- Extract keyboard navigation helpers to `keyboard-navigation.ts`.
- Extract selection mode helpers to `selection-helpers.ts`.
- Consider splitting the grid header (search, filter, layout toggle) into a separate `GalleryHeader.svelte` component (optional).

### Phase 4: Refactor `src/components/gallery/ViewerWrapper.svelte` (~400 lines)
- Extract PhotoSwipe initialization and event handling to `photoswipe‑integration.ts`.
- Extract video player handling (play/pause, fullscreen) to `video‑player.ts`.
- Extract object‑URL lifecycle management to `object‑url‑lifecycle.ts`.
- Keep the main component as coordinator.

### Phase 5: Validation
1. Type check (`npm run check`).
2. Short test suite (`npm run test:short`).
3. Manual smoke test of all affected flows (auth, dialog browsing, gallery grid, viewer, settings).

## Detailed Steps

### Step 0: Analysis & Planning

**File inventory:**

| File | Lines | Primary responsibilities |
|------|-------|--------------------------|
| `mtcute.ts` | 457 | MtcuteAdapter class: authentication, dialog listing, media download, message mapping. |
| `mock.ts` | 457 | MockAdapter class: simulated data loading, artificial delays, cache‑first logic. |
| `GalleryGrid.svelte` | ~500 | Gallery grid/masonry rendering, search/filter UI, selection mode, keyboard navigation, bulk actions. |
| `ViewerWrapper.svelte` | ~400 | PhotoSwipe viewer wrapper, video player integration, overlay UI, download/copy/share actions. |

**Extraction strategy:**
- Create `src/lib/telegram/utils/` directory for shared adapter utilities.
- Create `src/lib/telegram/mock‑data/` for mock sample data.
- Create `src/components/gallery/utils/` for gallery‑specific helpers.
- Keep existing imports and exports unchanged; only move code.

### Step 1: Refactor `mtcute.ts`

**Current structure:**
- Top‑level helper functions (lines 13‑…).
- `MtcuteAdapter` class with methods: `authenticate`, `getDialogs`, `getMedia`, `downloadMedia`, etc.
- Internal mapping functions (`mapPeer`, `mapMessage`).

**Proposed extractions:**

1. **`src/lib/telegram/utils/mtcute‑helpers.ts`**
   - `errorMessage`, `isPasswordRequired`, `documentDimensions`, `documentDuration`, `fileLikeName`.
   - `mapPeer`, `mapMessage` (if not already exported).
   - `downloadMedia` (if pure).
2. **`src/lib/telegram/utils/constants.ts`**
   - `getSizeLimitForMediaType` (already imported from `./constants`; keep there).
   - Any hard‑coded numbers (e.g., default limits).
3. **`src/lib/telegram/utils/cache‑first.ts`** (shared with mock)
   - Cache‑first logic for `getDialogs` (already implemented in both adapters). Could be unified.

**Implementation steps:**
1. Create new files with extracted functions.
2. Update imports in `mtcute.ts` to use new modules.
3. Verify no change in behavior (run tests).

### Step 2: Refactor `mock.ts`

**Current structure:**
- Sample data loading functions (`loadDialogs`, `loadMedia`, `loadMessages`).
- `MockAdapter` class with similar interface to `MtcuteAdapter`.
- Artificial delay simulation (`delay` method).
- Cache‑first logic (duplicated from mtcute).

**Proposed extractions:**

1. **`src/lib/telegram/mock‑data/index.ts`**
   - `loadDialogs`, `loadMedia`, `loadMessages`.
   - Sample file paths (`samples/`).
2. **`src/lib/telegram/mock‑delay.ts`**
   - `delay` function (configurable).
3. **Share `cache‑first.ts`** (see Step 1).

**Implementation steps:**
1. Move data‑loading functions to new module.
2. Move delay logic.
3. Import shared cache‑first utility.
4. Update `mock.ts` imports.

### Step 3: Refactor `GalleryGrid.svelte`

**Current structure:**
- Large `<script>` block with many reactive statements.
- Masonry layout detection and CSS.
- Keyboard navigation (arrow keys, Enter, Space).
- Selection mode (long‑press, shift‑range, selection header).
- Search/filter UI.

**Proposed extractions:**

1. **`src/components/gallery/utils/masonry.ts`**
   - `useMasonryLayout` function returning detection logic.
   - CSS class generation.
2. **`src/components/gallery/utils/keyboard‑navigation.ts`**
   - `handleGalleryKeyDown` handler.
   - Focus movement helpers.
3. **`src/components/gallery/utils/selection‑helpers.ts`**
   - Selection state helpers (`toggleSelection`, `selectRange`).
   - Long‑press detection.
4. **Optional:** Extract `<GalleryHeader>` component (search bar, filter pills, layout toggle). This would reduce lines but increase component count; decide after analysis.

**Implementation steps:**
1. Create utility modules, export pure functions.
2. Replace inline functions with imports.
3. Keep Svelte reactivity (`$state`, `$effect`) inside the component; move only pure logic.

### Step 4: Refactor `ViewerWrapper.svelte`

**Current structure:**
- PhotoSwipe initialization and event binding.
- Video player creation/destruction.
- Object URL management (`createObjectURL`/`revokeObjectURL`).
- Viewer actions (download, copy link, share, forward).

**Proposed extractions:**

1. **`src/components/gallery/utils/photoswipe‑integration.ts`**
   - `initPhotoSwipe`, `destroyPhotoSwipe`.
   - Event handler attachment.
2. **`src/components/gallery/utils/video‑player.ts`**
   - `createVideoPlayer`, `destroyVideoPlayer`.
   - Fullscreen and play/pause handling.
3. **`src/components/gallery/utils/object‑url‑lifecycle.ts`**
   - `createMediaUrl`, `revokeMediaUrl` with tracking.

**Implementation steps:**
1. Move PhotoSwipe‑related code to separate module.
2. Move video‑player code.
3. Move object‑URL helpers.
4. Update component imports.

### Step 5: Validation

**Type check:**
```bash
docker run --rm --network host -v "$(pwd)":/app -w /app node:24-alpine npm run check
```
Expected: 0 errors, 0 warnings.

**Short test suite:**
```bash
docker-compose -f docker-compose.test.yml up --build playwright
```
Expected: 32/32 tests pass.

**Manual smoke test:**
- Authenticate (mock).
- Browse dialogs, switch tabs.
- Open gallery, switch between grid/masonry, test keyboard navigation.
- Select items, trigger bulk actions.
- Open viewer, navigate between photos/videos, test download/copy/share.
- Verify no console errors.

## Success Criteria

1. Each target file is reduced by at least 30% in line count (excluding imports).
2. No change in external behavior (all existing tests pass).
3. New modules are focused, with clear single responsibility.
4. TypeScript strict mode satisfied.
5. No regression in performance or user experience.

## Files to Modify

**Primary:**
- `src/lib/telegram/mtcute.ts`
- `src/lib/telegram/mock.ts`
- `src/components/gallery/GalleryGrid.svelte`
- `src/components/gallery/ViewerWrapper.svelte`

**New files (estimated):**
- `src/lib/telegram/utils/mtcute‑helpers.ts`
- `src/lib/telegram/utils/cache‑first.ts`
- `src/lib/telegram/mock‑data/index.ts`
- `src/lib/telegram/mock‑delay.ts`
- `src/components/gallery/utils/masonry.ts`
- `src/components/gallery/utils/keyboard‑navigation.ts`
- `src/components/gallery/utils/selection‑helpers.ts`
- `src/components/gallery/utils/photoswipe‑integration.ts`
- `src/components/gallery/utils/video‑player.ts`
- `src/components/gallery/utils/object‑url‑lifecycle.ts`

**No changes required in:**
- `src/lib/telegram/adapter.ts` (interface unchanged)
- `src/stores/` (state management unchanged)
- `APPLICATION_SPEC.md`
- `STATUS.md` (will be updated after implementation)

## Potential Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Broken imports after extraction | Keep old imports temporarily, refactor incrementally, verify after each extraction. |
| Lost reactivity in Svelte components | Keep `$state` and `$effect` inside component; only move pure functions. |
| Increased bundle size due to extra modules | Use tree‑shaking; extra overhead negligible. |
| Merge conflicts with ongoing work | Coordinate with current active plan; ensure no overlapping changes. |

## Estimated Effort

**High** – requires careful analysis, incremental extraction, and thorough validation.

## Blockers

None identified.

## Notes

- Follow existing code style and naming conventions.
- Use `git mv` to preserve history when moving functions.
- Update `STATUS.md` after each phase (or after each extracted module) with validation results.
- Commit with conventional messages (`refactor: extract mtcute helper functions`, `refactor: split GalleryGrid utilities`, etc.).