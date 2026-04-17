# Task 53: Touch Target Sizing Implementation Plan

> **Status:** active
> **Date:** 2026-04-17
> **Based on:** Clever Island plan Block 2.4 requirements
> **Parent Plan:** `.kilo/plans/1776410435637-clever-island.md`

---

## Executive Summary

Task 53 ensures all interactive elements meet the WCAG 2.2 minimum touch target size of 44×44 pixels on mobile viewports (≤720px width). The audit covers buttons, toggles, icon-only controls, and any clickable/tappable UI component. The implementation adds appropriate padding, min‑height/min‑width, or hit‑area expansion while preserving visual design.

## Current State Assessment

Partial implementation exists in `src/app.css` lines 257‑302:
- `.button` elements have `min‑height: 44px; min‑width: 44px;` inside `@media (max‑width: 720px)`
- `.toast .close` buttons have `min‑height: 44px; min‑width: 44px;`
- `.viewer‑ui .nav` buttons have `min‑height: 60px; min‑width: 60px;`
- `.tabs .tab` elements have `min‑height: 44px;`
- `.media‑card` elements have `min‑height: 44px;`
- `.dialog‑item` elements have `min‑height: 60px;`

**Gaps identified:**
1. Icon‑only buttons without explicit `.button` class (e.g., viewer close, download, copy link, gallery back buttons)
2. Selection marks, cache badges, author badges that may be interactive
3. Settings toggles, checkboxes, radio buttons
4. Search input clear buttons
5. Dialog picker close button (×) and dialog items
6. Any custom interactive elements in desktop‑only layouts

## Implementation Details

### 1. Audit Interactive Elements
**Method:** Systematic review of all Svelte components and CSS classes.

**Files to examine:**
- `src/components/gallery/MediaItem.svelte` – cache badge, author badge, selection mark
- `src/components/gallery/ViewerWrapper.svelte` – close, download, copy link, navigation buttons
- `src/components/gallery/GalleryGrid.svelte` – back button, layout toggle, filter pills
- `src/components/dialogs/DialogItem.svelte` – entire dialog item (already 60px height)
- `src/components/dialogs/DialogList.svelte` – dialog items
- `src/components/gallery/DialogPicker.svelte` – close button (×), dialog items, confirm/cancel buttons
- `src/components/ui/Toast.svelte` – close button (already covered)
- `src/components/settings/SettingsPanel.svelte` – toggles, checkboxes, radio buttons
- `src/components/auth/*.svelte` – QR/phone form inputs and buttons
- `src/components/ui/CacheIndicator.svelte` – if interactive
- `src/components/layout/DesktopSidebar.svelte` – any interactive elements

**Audit criteria:**
- Element is clickable/tappable (has `on:click`, `on:tap`, or `role="button"` with keyboard handler)
- On mobile viewports (≤720px width), effective touch area must be ≥44×44px
- Check both visual size (`width`/`height`) and hit area (`padding`, `margin`, `::after` pseudo‑elements)

### 2. Implement Mobile‑Only CSS Rules
**Strategy:** Extend the existing `@media (max‑width: 720px)` block in `src/app.css`.

**Candidate rules:**
```css
@media (max‑width: 720px) {
  /* Icon‑only buttons */
  .icon‑button,
  button[aria‑label] {
    min‑height: 44px;
    min‑width: 44px;
    padding: 12px;
  }

  /* Small badges that are clickable */
  .badge[role="button"],
  .cache‑badge[role="button"] {
    min‑height: 44px;
    min‑width: 44px;
  }

  /* Settings toggles and checkboxes */
  .toggle,
  input[type="checkbox"],
  input[type="radio"] {
    min‑height: 44px;
    min‑width: 44px;
  }

  /* Search clear button */
  .search‑input + button {
    min‑height: 44px;
    min‑width: 44px;
  }

  /* Ensure hit‑area expansion for small visual elements */
  .selection‑mark {
    padding: 8px;
  }
}
```

**Implementation approach:**
1. Add CSS classes to problematic elements if they lack semantic selectors
2. Use `padding` to expand hit area while keeping visual size appropriate
3. For elements that cannot be enlarged (e.g., small icons), wrap in a larger transparent container
4. Preserve desktop appearance (no changes outside mobile media query)

### 3. Component‑Specific Fixes

**MediaItem.svelte:**
- Cache badge (28×28px) – add `padding: 8px` on mobile or increase size
- Author badge (auto width, min‑width 44px) – already sufficient
- Selection mark (28×28px) – add `padding: 8px` on mobile

**ViewerWrapper.svelte:**
- Close, download, copy link buttons – ensure they have `.button` class or explicit `min‑height/min‑width`
- Navigation arrows (`.nav`) – already 60×60px, sufficient

**GalleryGrid.svelte:**
- Back button (icon‑only) – add `.button` class or explicit sizing
- Layout toggle button – ensure adequate padding
- Filter pills – ensure `min‑height: 44px`

**DialogPicker.svelte:**
- Close button (×) – add `min‑height: 44px; min‑width: 44px; padding: 12px;`
- Dialog items – already sufficient (≥60px height)

**SettingsPanel.svelte:**
- Toggle switches – ensure `min‑height: 44px` for the interactive area
- Checkboxes/radios – ensure adequate touch target

### 4. Validation
**Manual testing:**
- Use browser DevTools device emulation (iPhone SE, Pixel 5)
- Verify each interactive element meets 44×44px when measured with element inspector
- Test touch/click functionality remains intact

**Automated checks:**
- `npm run check` passes (0 errors, 0 warnings)
- `npm run test:short` passes (32/32)
- No visual regressions in desktop view

## Success Criteria

1. **Quantitative:** All interactive elements on mobile viewports (≤720px) have computed dimensions ≥44×44px.
2. **Qualitative:** No visual distortion on desktop; mobile touch targets feel comfortable.
3. **Functional:** All existing click/tap handlers continue to work.
4. **Validation:** Type check and short test suite pass.

## Files to Modify

- `src/app.css` – extend mobile media query with new touch‑target rules
- `src/components/gallery/MediaItem.svelte` – adjust cache badge and selection mark padding
- `src/components/gallery/ViewerWrapper.svelte` – ensure icon buttons have proper classes
- `src/components/gallery/GalleryGrid.svelte` – ensure back button and filter pills are sized
- `src/components/gallery/DialogPicker.svelte` – size close button
- `src/components/settings/SettingsPanel.svelte` – ensure toggle/checkbox touch targets
- (Potentially) other component files if audit reveals additional gaps

## Risks & Mitigations

- **Visual distortion:** Changes limited to mobile media query; desktop appearance unchanged.
- **CSS specificity conflicts:** Use explicit class names rather than broad selectors.
- **Over‑sizing:** Use `padding` to expand hit area while keeping visual content appropriately sized.
- **Missing elements:** Systematic audit ensures coverage.

## Dependencies

- None; this task is self‑contained UI polish.

## Validation Requirements

### Mandatory after implementation:
- `docker run --rm --network host -v "$(pwd)":/app -w /app node:24‑alpine npm run check`
- `docker‑compose -f docker‑compose.test.yml up --build playwright`
- Manual verification of 3‑5 key interactive elements on mobile emulation
- Update `STATUS.md` with completion evidence and commit hash

---

**Next Step:** Execute the audit and implement CSS changes.