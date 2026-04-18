# Block 4: Phase 3+ Advanced Features Implementation Plan

> **Status:** completed

Task implemented as part of Clever Island Block 4.
> **Date:** 2026-04-17
> **Based on:** Clever Island plan Block 4 requirements
> **Parent Plan:** `.kilo/plans/1776410435637-clever-island.md`

---

## Executive Summary

Block 4 implements advanced Phase 3+ features to enhance the Telegram Gallery's visual appeal, usability, and offline capabilities. This includes masonry layout for better image display, desktop layout variants for improved large-screen experience, complete light theme support, and enhanced offline media behavior.

## Block 4 Tasks

### Task 61: Masonry Layout Toggle
**Goal:** Implement masonry layout that preserves image aspect ratios with auto-detection and manual override.

**Implementation Details:**
1. **Settings Extension:**
   - Add `layoutMode: 'grid' | 'masonry'` to `AppSettings` type
   - Add `autoDetectMasonry: boolean` setting
   - Update `src/stores/settings.ts` with defaults

2. **Auto-Detection Logic:**
   - Analyze first 100 loaded media items in gallery
   - Count visual types (photos, videos)
   - If ≥90% visual content, suggest masonry layout
   - Store user preference overriding auto-detection

3. **CSS Implementation:**
   - Use `grid-template-rows: masonry` (modern browsers)
   - Fallback: CSS columns layout for unsupported browsers
   - Preserve image aspect ratios in masonry mode

4. **UI Controls:**
   - Add layout toggle button in gallery header
   - Tooltip explaining layout modes
   - Visual indicator for current layout

**Files:**
- `src/stores/settings.ts` - Add layout settings
- `src/components/gallery/GalleryGrid.svelte` - Layout logic and UI
- `src/app.css` - Masonry CSS styles
- `src/types/telegram.ts` - Update AppSettings type

### Task 62: Desktop Layout Variants
**Goal:** Optimize layout for desktop screens with additional space utilization.

**Implementation Details:**
1. **Desktop Detection:**
   - Detect screen width > 1024px as desktop
   - Responsive breakpoint adjustments

2. **Layout Variants:**
   - **Wide Grid:** Increased columns (6-8) on desktop
   - **Sidebar Layout:** Optional sidebar for metadata/actions
   - **Dual Pane:** Split view for browsing while viewing

3. **Settings:**
   - Add `desktopLayout: 'wide' | 'sidebar' | 'dual'` setting
   - Auto-apply based on screen size with user override

4. **CSS Adjustments:**
   - Desktop-specific media queries
   - Improved spacing and typography for larger screens

**Files:**
- `src/stores/settings.ts` - Add desktop layout settings
- `src/components/gallery/GalleryGrid.svelte` - Desktop layout logic
- `src/app.css` - Desktop layout styles
- `src/components/layout/DesktopSidebar.svelte` (new) - Sidebar component

### Task 63: Light Theme Support
**Goal:** Complete light theme implementation with system preference detection.

**Implementation Details:**
1. **CSS Variable Completion:**
   - Ensure all color variables have light theme equivalents
   - Test contrast ratios for accessibility (WCAG AA)

2. **Theme Switching:**
   - Enhance existing `applyTheme` function
   - Add theme toggle in settings panel
   - Support `'system'` theme option

3. **Component Audits:**
   - Check all components for hardcoded colors
   - Replace with CSS variables
   - Test both themes in all components

4. **Persistent Preference:**
   - Store theme preference in settings
   - Apply on app startup
   - Respect `prefers-color-scheme` for system theme

**Files:**
- `src/app.css` - Complete light theme variables
- `src/stores/settings.ts` - Enhance theme handling
- `src/components/settings/SettingsScreen.svelte` - Add theme selector
- All component files - Audit for color usage

### Task 64: Enhanced Offline Media Behavior
**Goal:** Improve offline experience with better cache management and user feedback.

**Implementation Details:**
1. **Cache Status Indicators:**
   - Add visual badges on thumbnails for cache status
   - Differentiate: cached, downloading, remote only
   - Optional setting to show/hide indicators

2. **Offline Action Guards:**
   - Clear feedback when actions require connectivity
   - Disable buttons with tooltip explanations
   - Queue actions for when back online

3. **Cache Management UI:**
   - Enhanced cache settings in preferences
   - Clear cache by type/size/age
   - Cache usage visualization

4. **OPFS Optimization:**
   - Improve file organization in OPFS
   - Better error recovery for cache operations
   - Progress indicators for cache operations

**Files:**
- `src/components/gallery/MediaItem.svelte` - Cache status badges
- `src/components/gallery/MediaListRow.svelte` - Cache status badges
- `src/stores/gallery.ts` - Enhanced offline action guards
- `src/lib/cache/opfs.ts` - OPFS optimizations
- `src/components/settings/SettingsScreen.svelte` - Cache management UI

### Task 65: Validation
**Goal:** Ensure all Block 4 features work correctly and don't break existing functionality.

**Implementation Details:**
1. **Type Checking:** `npm run check` must pass with 0 errors, 0 warnings
2. **Short Test Suite:** `npm run test:short` must pass 32/32 tests
3. **Visual Testing:** Manual verification of all new features
4. **Cross-browser Testing:** Chrome, Firefox, Safari compatibility
5. **Responsive Testing:** Mobile and desktop layouts

## Implementation Order

1. **Foundation First** (Tasks 63, 61):
   - Complete light theme support (Task 63) - builds on existing infrastructure
   - Masonry layout toggle (Task 61) - moderate complexity

2. **Desktop Enhancement** (Task 62):
   - Desktop layout variants - depends on responsive CSS foundation

3. **Offline Improvements** (Task 64):
   - Enhanced offline behavior - most complex, can be done independently

4. **Validation** (Task 65):
   - Final testing and verification

## Success Criteria

### Technical:
- All TypeScript errors resolved
- All existing tests pass
- No performance regressions
- Accessible (WCAG AA compliance)
- Responsive across all screen sizes

### User Experience:
- Smooth theme switching with no flash
- Masonry layout improves image browsing
- Desktop layouts feel native on large screens
- Clear offline status and capabilities
- All features work consistently

## Risks & Mitigations

1. **CSS Compatibility:** Masonry layout may not work in older browsers
   - Mitigation: Feature detection with fallback to grid layout

2. **Performance Impact:** Desktop layouts may affect mobile performance
   - Mitigation: Conditional loading, lazy initialization

3. **Theme Consistency:** Light theme may reveal hidden color issues
   - Mitigation: Comprehensive component audit, contrast checking

4. **Cache Complexity:** Enhanced offline features may introduce bugs
   - Mitigation: Thorough testing, error boundaries, graceful degradation

## Dependencies

- **Block 2:** TypeScript/LSP fixes must be complete
- **Block 3:** Core interaction improvements provide foundation
- **Existing Settings Store:** Requires stable settings persistence
- **OPFS Infrastructure:** Must be functional for cache enhancements

## Estimated Effort

- **Task 61 (Masonry):** Medium (2-3 hours)
- **Task 62 (Desktop):** Medium (2-3 hours)  
- **Task 63 (Light Theme):** Low-Medium (1-2 hours)
- **Task 64 (Offline):** High (3-4 hours)
- **Task 65 (Validation):** Low (1 hour)
- **Total:** ~9-13 hours

---

**Next Step:** Begin implementation with Task 63 (Light Theme Support) as it builds on existing infrastructure and provides immediate visual improvement.

**Plan Reference:** This plan implements Block 4 of `.kilo/plans/1776410435637-clever-island.md`