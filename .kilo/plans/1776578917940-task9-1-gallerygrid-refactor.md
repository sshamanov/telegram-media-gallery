# Task 9.1: Refactor GalleryGrid.svelte

**Goal:** Split the 1468‑line `GalleryGrid.svelte` component into smaller, focused modules to improve maintainability and testability.

**Plan ID:** 1776578917940-task9-1-gallerygrid-refactor  
**Created:** 2026-04-19 13:22:20 +02:00  
**Status:** pending  

## Overview

`GalleryGrid.svelte` is the largest component in the codebase (1468 lines). It handles:
- Masonry/grid layout rendering and detection
- Keyboard navigation (arrow keys, Enter, Space)
- Selection mode (long‑press, shift‑range, selection header)
- Search/filter UI and author filtering
- Bulk actions (download, forward, share, copy, upload)
- Desktop layout variants (wide grid, sidebar, dual pane)
- Pull‑to‑refresh for mobile
- Scroll position persistence

This task will extract pure logic into utility modules, keeping Svelte reactivity (`$state`, `$effect`) in the main component.

## Execution Order

### Phase 1: Analysis & Planning
1. Examine component structure, identify logical seams.
2. List all helper functions, constants, and reusable UI blocks.
3. Decide on new file names and locations.

### Phase 2: Extract Masonry Layout Logic
- Create `src/components/gallery/utils/masonry.ts`
- Move masonry detection logic (`useMasonryLayout` function)
- Move CSS class generation for masonry vs grid
- Keep responsive breakpoint detection in component

### Phase 3: Extract Keyboard Navigation Helpers
- Create `src/components/gallery/utils/keyboard-navigation.ts`
- Move `handleGalleryKeyDown` handler
- Move focus movement helpers (`moveFocusUp`, `moveFocusDown`, etc.)
- Keep keyboard event binding in component

### Phase 4: Extract Selection Mode Helpers
- Create `src/components/gallery/utils/selection-helpers.ts`
- Move `toggleSelection`, `selectRange`, `selectAllVisible` logic
- Move long‑press detection utilities
- Keep selection state (`$state`) in component

### Phase 5: Extract Bulk Action Helpers (Optional)
- Create `src/components/gallery/utils/bulk-actions.ts`
- Move download/forward/share/copy/upload queue coordination
- Keep queue state in component

### Phase 6: Validation
1. Type check (`npm run check`)
2. Short test suite (`npm run test:short`)
3. Manual smoke test of all gallery flows

## Detailed Steps

### Step 1: Analysis

**Current structure highlights:**
- Lines 1‑200: Imports and reactive state declarations
- Lines 200‑400: Lifecycle hooks (`onMount`, `onDestroy`)
- Lines 400‑600: Masonry layout detection and CSS
- Lines 600‑800: Keyboard navigation handlers
- Lines 800‑1000: Selection mode logic
- Lines 1000‑1200: Bulk action coordination
- Lines 1200‑1468: Template rendering

**Extraction candidates:**
1. **Masonry layout** (lines 400‑600): Pure detection logic, CSS class generation
2. **Keyboard navigation** (lines 600‑800): Key handlers, focus movement
3. **Selection helpers** (lines 800‑1000): Toggle/range selection, long‑press
4. **Bulk actions** (lines 1000‑1200): Queue coordination (optional)

### Step 2: Create Utility Directory

Ensure the target directory exists:
```bash
mkdir -p src/components/gallery/utils
```

### Step 3: Extract Masonry Layout

**File:** `src/components/gallery/utils/masonry.ts`

```typescript
export function useMasonryLayout(
  settings: { layoutMode: GalleryLayoutMode },
  mediaItems: MediaItem[],
  containerRef: HTMLElement | null
): {
  shouldUseMasonry: boolean
  masonryClass: string
  columnCount: number
} {
  // Implementation from GalleryGrid.svelte
}
```

**Keep in component:** Responsive breakpoint detection, `$effect` for auto‑detection.

### Step 4: Extract Keyboard Navigation

**File:** `src/components/gallery/utils/keyboard-navigation.ts`

```typescript
export function handleGalleryKeyDown(
  event: KeyboardEvent,
  options: {
    mediaItems: MediaItem[]
    focusedIndex: number
    isSelectionMode: boolean
    // ... other context
  }
): {
  handled: boolean
  newFocusedIndex?: number
  action?: 'open' | 'toggle' | 'exit'
} {
  // Implementation from GalleryGrid.svelte
}

export function moveFocusUp(currentIndex: number, columnCount: number): number
export function moveFocusDown(currentIndex: number, columnCount: number, totalItems: number): number
// ... other movement helpers
```

**Keep in component:** Event listener binding, focus state management.

### Step 5: Extract Selection Helpers

**File:** `src/components/gallery/utils/selection-helpers.ts`

```typescript
export function toggleSelection(
  mediaId: string,
  currentSelection: Set<string>,
  anchorId?: string
): { newSelection: Set<string>; newAnchorId?: string }

export function selectRange(
  startId: string,
  endId: string,
  mediaItems: MediaItem[],
  currentSelection: Set<string>
): Set<string>

export function createLongPressHandler(
  mediaId: string,
  onLongPress: () => void,
  delayMs: number = 500
): { onTouchStart: () => void; onTouchEnd: () => void; onTouchCancel: () => void }
```

**Keep in component:** Selection state (`$state`), touch event binding.

### Step 6: Extract Bulk Actions (Optional)

**File:** `src/components/gallery/utils/bulk-actions.ts`

```typescript
export function prepareBulkDownload(
  mediaIds: string[],
  dialogId: string
): { totalSize: number; estimatedTime: number }

export function validateForwardTarget(
  targetDialogId: string,
  mediaIds: string[]
): boolean

// ... other bulk action coordination
```

**Keep in component:** Queue state, progress tracking.

### Step 7: Update Component Imports

Replace inline functions with imports:
```typescript
import { useMasonryLayout } from './utils/masonry'
import { handleGalleryKeyDown } from './utils/keyboard-navigation'
import { toggleSelection, selectRange } from './utils/selection-helpers'
```

### Step 8: Validation

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
- Open gallery, switch between grid/masonry
- Test keyboard navigation (arrow keys, Enter, Space)
- Enter selection mode (long‑press or Ctrl+click)
- Select range with Shift+click
- Trigger bulk download/forward
- Verify no console errors

## Success Criteria

1. `GalleryGrid.svelte` reduced by at least 30% (target: <1000 lines)
2. New utility modules are focused, with clear single responsibility
3. No change in external behavior (all existing tests pass)
4. TypeScript strict mode satisfied
5. No regression in performance or user experience

## Files to Modify

**Primary:**
- `src/components/gallery/GalleryGrid.svelte`

**New files:**
- `src/components/gallery/utils/masonry.ts`
- `src/components/gallery/utils/keyboard-navigation.ts`
- `src/components/gallery/utils/selection-helpers.ts`
- `src/components/gallery/utils/bulk-actions.ts` (optional)

**No changes required in:**
- `src/stores/gallery.ts` (state management unchanged)
- `src/lib/media.ts` (filter logic unchanged)
- `APPLICATION_SPEC.md`
- `STATUS.md` (will be updated after implementation)

## Potential Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Broken imports after extraction | Keep old functions temporarily, refactor incrementally |
| Lost reactivity | Keep `$state` and `$effect` in component; only move pure functions |
| Increased bundle size | Use tree‑shaking; extra overhead negligible |
| Merge conflicts with ongoing work | Coordinate with current active plan |

## Estimated Effort

**Medium** – requires careful analysis and incremental extraction.

## Blockers

None identified.

## Notes

- Follow existing code style and naming conventions.
- Update `STATUS.md` after each phase with validation results.
- Commit with conventional messages (`refactor: extract masonry layout logic`, etc.).
- This is a subtask of Task 9; parent plan status is `partially_completed`.