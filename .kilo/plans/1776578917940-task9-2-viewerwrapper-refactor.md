# Task 9.2: Refactor ViewerWrapper.svelte

**Goal:** Split the 873‑line `ViewerWrapper.svelte` component into smaller, focused modules to improve maintainability and testability.

**Plan ID:** 1776578917940-task9-2-viewerwrapper-refactor  
**Created:** 2026-04-19 13:22:20 +02:00  
**Status:** pending  

## Overview

`ViewerWrapper.svelte` handles the full‑screen media viewer experience:
- PhotoSwipe initialization and event binding
- Video player creation/destruction and controls
- Object URL lifecycle management (`createObjectURL`/`revokeObjectURL`)
- Viewer actions (download, copy link, share, forward)
- Overlay UI and navigation controls

This task will extract pure logic into utility modules, keeping Svelte reactivity (`$state`, `$effect`) and component lifecycle in the main component.

## Execution Order

### Phase 1: Analysis & Planning
1. Examine component structure, identify logical seams.
2. List all helper functions, constants, and reusable UI blocks.
3. Decide on new file names and locations.

### Phase 2: Extract PhotoSwipe Integration
- Create `src/components/gallery/utils/photoswipe-integration.ts`
- Move PhotoSwipe initialization (`initPhotoSwipe`)
- Move PhotoSwipe destruction (`destroyPhotoSwipe`)
- Move event handler attachment (slide change, close, etc.)
- Keep PhotoSwipe instance state in component

### Phase 3: Extract Video Player Handling
- Create `src/components/gallery/utils/video-player.ts`
- Move video player creation (`createVideoPlayer`)
- Move video player destruction (`destroyVideoPlayer`)
- Move fullscreen and play/pause handling
- Keep video element references in component

### Phase 4: Extract Object‑URL Lifecycle
- Create `src/components/gallery/utils/object-url-lifecycle.ts`
- Move `createMediaUrl` with tracking
- Move `revokeMediaUrl` with cleanup
- Move URL revocation scheduling
- Keep URL map state in component

### Phase 5: Extract Viewer Action Helpers (Optional)
- Create `src/components/gallery/utils/viewer-actions.ts`
- Move download/copy/share/forward action coordination
- Move progress tracking for viewer actions
- Keep action state in component

### Phase 6: Validation
1. Type check (`npm run check`)
2. Short test suite (`npm run test:short`)
3. Manual smoke test of viewer flows

## Detailed Steps

### Step 1: Analysis

**Current structure highlights:**
- Lines 1‑150: Imports and reactive state declarations
- Lines 150‑300: Lifecycle hooks (`onMount`, `onDestroy`)
- Lines 300‑450: PhotoSwipe initialization and event handlers
- Lines 450‑600: Video player handling
- Lines 600‑700: Object‑URL lifecycle management
- Lines 700‑800: Viewer action handlers
- Lines 800‑873: Template rendering

**Extraction candidates:**
1. **PhotoSwipe integration** (lines 300‑450): Pure PhotoSwipe API interaction
2. **Video player** (lines 450‑600): Video element manipulation
3. **Object‑URL lifecycle** (lines 600‑700): URL creation/revocation tracking
4. **Viewer actions** (lines 700‑800): Action coordination (optional)

### Step 2: Create Utility Directory

Ensure the target directory exists:
```bash
mkdir -p src/components/gallery/utils
```

### Step 3: Extract PhotoSwipe Integration

**File:** `src/components/gallery/utils/photoswipe-integration.ts`

```typescript
import type PhotoSwipe from 'photoswipe'

export function initPhotoSwipe(
  element: HTMLElement,
  options: {
    items: PhotoSwipe.Item[]
    index: number
    onClose: () => void
    onSlideChange: (instance: PhotoSwipe) => void
    // ... other options
  }
): PhotoSwipe

export function destroyPhotoSwipe(instance: PhotoSwipe | null): void

export function attachPhotoSwipeEvents(
  instance: PhotoSwipe,
  handlers: {
    onClose: () => void
    onSlideChange: (instance: PhotoSwipe) => void
    // ... other handlers
  }
): () => void // Returns cleanup function
```

**Keep in component:** PhotoSwipe instance state, reactive options.

### Step 4: Extract Video Player Handling

**File:** `src/components/gallery/utils/video-player.ts`

```typescript
export function createVideoPlayer(
  container: HTMLElement,
  mediaUrl: string,
  options: {
    autoplay?: boolean
    controls?: boolean
    onPlay?: () => void
    onPause?: () => void
    onEnded?: () => void
  }
): {
  videoElement: HTMLVideoElement
  play: () => Promise<void>
  pause: () => void
  requestFullscreen: () => Promise<void>
  destroy: () => void
}

export function handleVideoFullscreen(
  videoElement: HTMLVideoElement,
  onFullscreenChange: (isFullscreen: boolean) => void
): () => void // Returns cleanup function
```

**Keep in component:** Video player state, UI controls binding.

### Step 5: Extract Object‑URL Lifecycle

**File:** `src/components/gallery/utils/object-url-lifecycle.ts`

```typescript
export function createMediaUrl(
  blob: Blob,
  trackMap: Map<string, string>
): string

export function revokeMediaUrl(
  url: string,
  trackMap: Map<string, string>
): void

export function scheduleUrlRevocation(
  url: string,
  delayMs: number,
  trackMap: Map<string, string>
): () => void // Returns cancellation function

export function cleanupAllUrls(trackMap: Map<string, string>): void
```

**Keep in component:** URL tracking map (`$state`), cleanup in `onDestroy`.

### Step 6: Extract Viewer Actions (Optional)

**File:** `src/components/gallery/utils/viewer-actions.ts`

```typescript
export function prepareViewerDownload(
  mediaItem: MediaItem,
  dialogId: string
): { size: number; estimatedTime: number }

export function copyViewerLink(
  mediaItem: MediaItem,
  dialogId: string
): string // Returns copied URL

export function validateShareTarget(
  mediaItem: MediaItem
): boolean

// ... other viewer action coordination
```

**Keep in component:** Action state, progress tracking, toast notifications.

### Step 7: Update Component Imports

Replace inline functions with imports:
```typescript
import { initPhotoSwipe, destroyPhotoSwipe } from './utils/photoswipe-integration'
import { createVideoPlayer } from './utils/video-player'
import { createMediaUrl, revokeMediaUrl } from './utils/object-url-lifecycle'
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
- Open viewer from gallery
- Navigate between photos/videos
- Test video playback (play/pause, fullscreen)
- Test viewer actions (download, copy link)
- Close viewer, verify cleanup
- Verify no console errors

## Success Criteria

1. `ViewerWrapper.svelte` reduced by at least 30% (target: <600 lines)
2. New utility modules are focused, with clear single responsibility
3. No change in external behavior (all existing tests pass)
4. TypeScript strict mode satisfied
5. No regression in performance or user experience
6. Object‑URL lifecycle properly maintained (no memory leaks)

## Files to Modify

**Primary:**
- `src/components/gallery/ViewerWrapper.svelte`

**New files:**
- `src/components/gallery/utils/photoswipe-integration.ts`
- `src/components/gallery/utils/video-player.ts`
- `src/components/gallery/utils/object-url-lifecycle.ts`
- `src/components/gallery/utils/viewer-actions.ts` (optional)

**No changes required in:**
- `src/stores/gallery.ts` (viewer state unchanged)
- `src/lib/telegram/adapter.ts` (media download unchanged)
- `APPLICATION_SPEC.md`
- `STATUS.md` (will be updated after implementation)

## Potential Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Broken PhotoSwipe event handling | Test event binding after extraction |
| Video player memory leaks | Ensure proper cleanup in extracted functions |
| Object‑URL lifecycle broken | Add validation that URLs are revoked |
| Increased bundle size | Use tree‑shaking; extra overhead negligible |
| Merge conflicts with ongoing work | Coordinate with current active plan |

## Estimated Effort

**Medium** – requires careful analysis and incremental extraction.

## Blockers

None identified.

## Notes

- Follow existing code style and naming conventions.
- Update `STATUS.md` after each phase with validation results.
- Commit with conventional messages (`refactor: extract PhotoSwipe integration`, etc.).
- This is a subtask of Task 9; parent plan status is `partially_completed`.