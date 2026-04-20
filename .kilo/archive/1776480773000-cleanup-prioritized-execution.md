# Cleanup and Prioritized Execution Plan

> Status: superseded
> Reason: Superseded by updated clever-island plan (1776410435637-clever-island.md)

## Goal
1. Clean up stale plans from `.kilo/plans/` directory to maintain project hygiene.
2. Fix remaining accessibility warnings in DialogPicker and GalleryGrid components.
3. Implement Phase 3+ advanced features: masonry layout toggle, desktop layout variants, light theme support.
4. Performance optimization: further improvements for download speed, memory usage, and bundle size.

## Status: superseded

## Current State
- All previous plans completed (jolly-planet, stellar-panda, phase-3-offline-kickoff, etc.)
- 14 stale plan files identified with old timestamps, not referenced in STATUS.md, some marked "ready for implementation" but superseded by later work.
- Accessibility warnings persist in DialogPicker and GalleryGrid (non-interactive elements with tabindex, mouse/keyboard listeners).
- Phase 3+ features planned in APPLICATION_SPEC.md but not implemented: masonry layout toggle, desktop layout variants, light theme support, enhanced offline media behavior.
- Performance improvements already implemented (buffer copy removal, progress throttling); opportunity for further optimization.

## Success Criteria
1. Stale plans archived in `.kilo/archive/` with appropriate status updates.
2. No accessibility warnings from svelte-check for DialogPicker and GalleryGrid.
3. Masonry layout toggle implemented in gallery settings and UI.
4. Desktop layout variants (info panel side, toast top) implemented.
5. Light theme toggle with complete styling.
6. Performance improvements measurable (faster downloads, smaller bundle, memory efficiency).
7. All changes pass type check and short test suite validation.

## Execution Blocks

### Block 1: Archive Stale Plans
**1.1 Inventory stale plans**
- List all plan files in `.kilo/plans/` with timestamps before 2026-04-15.
- Compare with STATUS.md references to identify which are already completed or superseded.
- Determine which plans are truly stale (not referenced, superseded, or obsolete).

**1.2 Update plan statuses**
- For each stale plan, add or update "## Status:" line to "superseded" or "obsolete" as appropriate.
- Add a brief note explaining why plan is stale (e.g., "Superseded by later implementation").

**1.3 Move to archive**
- Ensure `.kilo/archive/` directory exists.
- Move stale plan files to `.kilo/archive/` preserving directory structure if needed.
- Update `.gitignore` to include `.kilo/archive/` if not already present.

**1.4 Update STATUS.md**
- Add note about archival in "Plan And Todo History".
- Update "Completed Plans" section if any stale plans were previously listed.
- Ensure STATUS.md reflects current active plan only.

**1.5 Validation**
- Run `npm run check` to ensure no broken references.
- Verify grep shows no references to archived plans in active workflow docs.

### Block 2: Fix Accessibility Warnings
**2.1 Analyze current warnings**
- Run `npm run check` to capture exact warning messages.
- Identify specific elements causing warnings in DialogPicker and GalleryGrid.

**2.2 Fix DialogPicker warnings**
- Review overlay div with role="button" and tabindex.
- Ensure interactive elements have proper ARIA labels and roles.
- Replace non-interactive elements with appropriate semantic elements or remove interactive attributes.

**2.3 Fix GalleryGrid warnings**
- Review section with role="application" and tabindex.
- Address "non-interactive element with tabindex" and "non-interactive element with mouse/keyboard listeners".
- Ensure gallery shell uses appropriate ARIA landmarks.

**2.4 Test accessibility fixes**
- Run `npm run check` to confirm warnings are resolved.
- Test keyboard navigation and screen reader compatibility manually.

**2.5 Validation**
- Type check passes with 0 errors, 0 warnings.
- Short test suite passes (32/32).

### Block 3: Implement Masonry Layout Toggle
**3.1 Design masonry layout**
- Research masonry implementation options (CSS grid, CSS columns, JavaScript).
- Decide on CSS columns for simplicity and performance.
- Design toggle in gallery settings and UI control.

**3.2 Add masonry CSS**
- Create masonry layout styles that work with existing grid structure.
- Ensure responsive behavior across screen sizes.

**3.3 Implement toggle logic**
- Add masonry toggle to settings store.
- Update GalleryGrid to switch between uniform grid and masonry layout.
- Persist user preference in localStorage.

**3.4 Add UI control**
- Add masonry toggle button to gallery header or settings panel.
- Ensure proper labeling and accessibility.

**3.5 Validation**
- Test layout toggle visually and functionally.
- Run type check and short tests.

### Block 4: Implement Desktop Layout Variants
**4.1 Design desktop layouts**
- Define variants: info panel side (instead of bottom drawer), toast top (instead of bottom).
- Create CSS variables for layout configurations.

**4.2 Implement info panel side variant**
- Modify InfoPanel component to support side positioning.
- Add media query or class-based switching.

**4.3 Implement toast top variant**
- Update Toast component to support top positioning.
- Add setting to control toast position.

**4.4 Add layout settings**
- Add desktop layout preferences to settings store.
- Create UI controls in settings panel.

**4.5 Validation**
- Test layout variants on desktop viewport.
- Ensure responsive fallbacks.

### Block 5: Implement Light Theme Support
**5.1 Design light theme**
- Define color palette for light theme based on existing CSS variables.
- Ensure sufficient contrast ratios (WCAG AA).

**5.2 Implement theme switching**
- Add theme preference to settings store.
- Create CSS theme classes or data attributes.
- Implement theme toggle in settings panel and possibly global header.

**5.3 Apply light theme styles**
- Update all component styles to respect theme variables.
- Test across all screens and components.

**5.4 Persist theme preference**
- Save theme choice in localStorage.
- Apply theme on app initialization.

**5.5 Validation**
- Visual testing of light/dark themes.
- Contrast ratio verification.
- Type check and test suite passes.

### Block 6: Performance Optimization
**6.1 Analyze performance bottlenecks**
- Review download speed measurements from previous investigation.
- Identify opportunities for bundle size reduction.
- Check memory usage patterns.

**6.2 Implement download optimizations**
- Further optimize buffer handling if needed.
- Consider parallel downloads with limits.
- Improve progress reporting.

**6.3 Bundle size optimization**
- Analyze Vite bundle report.
- Implement code splitting where beneficial.
- Remove unused dependencies if any.

**6.4 Memory efficiency**
- Review object creation patterns in hot paths.
- Ensure proper cleanup of object URLs and event listeners.

**6.5 Validation**
- Performance metrics improvement (qualitative).
- Bundle size reduction measurable.
- Type check and test suite passes.

## Dependencies
- Block 1 can run independently.
- Blocks 2-6 can proceed sequentially after Block 1.
- Each block must pass validation before moving to next.

## Risk Mitigation
- Accessibility fixes may affect existing UI behavior; thorough testing required.
- Layout changes may break responsive design; test on multiple viewports.
- Theme implementation must not break existing dark theme.
- Performance optimizations must not introduce regressions.
