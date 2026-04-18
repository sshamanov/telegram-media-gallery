# Task 8: Remove Author Thumbnail Background

**Goal:** Replace the boxed author badge with a simple text overlay – remove background and backdrop‑filter, keep text readable on varying image backgrounds.

**Plan ID:** 1776540483162-task8-remove-author-thumbnail-background  
**Created:** 2026-04-18 21:28:03 +02:00  
**Status:** pending  

## Overview

Currently author names in gallery grid (`MediaItem.svelte`) and list view (`MediaListRow.svelte`) appear inside a semi‑opaque rounded box with backdrop‑filter. Task 8 requests removing that background so the text overlays the image directly, improving visual elegance.

## Execution Order

### Phase 0: Examine Current Styling
1. Locate `.badge.author` CSS in `MediaItem.svelte`.
2. Locate `.author` CSS in `MediaListRow.svelte`.
3. Understand current positioning and visual properties.

### Phase 1: Update MediaItem.svelte (Grid View)
1. Remove `background` and `backdrop‑filter` from `.badge.author`.
2. Adjust text color and optionally add a subtle text‑shadow for readability.
3. Ensure touch target size remains adequate (min‑width/height).

### Phase 2: Update MediaListRow.svelte (List View)
1. Remove background styling from `.author` class.
2. Adjust text color and positioning as needed.

### Phase 3: Cross‑Theme Verification
1. Verify readability in both light and dark theme variants.
2. Test with various image backgrounds (light/dark, busy patterns).

### Phase 4: Validation
1. Type check.
2. Short test suite.
3. Visual inspection in grid and list views.

## Detailed Steps

### Step 0: Examine Current Styling

**File:** `src/components/gallery/MediaItem.svelte`

Current `.badge.author` CSS (lines 280‑294):
```css
.badge.author {
  right: auto;
  left: 10px;
  top: 10px;
  bottom: auto;
  width: auto;
  min-width: 44px;
  max-width: 120px;
  height: auto;
  padding: 4px 8px;
  font-size: 0.72rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--bg-black-translucent-medium);
  backdrop-filter: blur(8px);
}
```

**File:** `src/components/gallery/MediaListRow.svelte`

Find `.author` class (line 248). Read surrounding lines.

### Step 1: Update MediaItem.svelte

**Modifications:**
1. Remove `background` and `backdrop‑filter` properties.
2. Change text color to a high‑contrast variable (e.g., `--text‑on‑image`). If none exists, use `white` with a subtle text‑shadow for dark backgrounds.
3. Keep positioning, padding, min‑width, etc. to maintain touch target size.

**Proposed updated CSS:**
```css
.badge.author {
  right: auto;
  left: 10px;
  top: 10px;
  bottom: auto;
  width: auto;
  min-width: 44px;
  max-width: 120px;
  height: auto;
  padding: 4px 8px;
  font-size: 0.72rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
```

**Considerations:**
- The `color` should adapt to theme. The existing `--text‑primary` may not contrast well on images. Use `white` for dark theme and `black` for light theme? Since the gallery background is dark by default, white is safe. For light theme, we may need to adjust via theme‑aware variable.
- Check if there is a CSS variable for overlay text (e.g., `--text‑on‑image`). If not, keep simple `white` with text‑shadow.

### Step 2: Update MediaListRow.svelte

**Locate `.author` class:** Use grep to find exact lines.

**Current CSS (likely):**
```css
.author {
  font-size: 0.85rem;
  color: var(--text-secondary);
  /* background? */
}
```

**Modifications:**
- Remove any `background` or `backdrop‑filter`.
- Adjust color for readability (maybe keep `var(--text‑secondary)`).

### Step 3: Cross‑Theme Verification

**Light theme:** Ensure text is visible on light‑coloured thumbnails. If using `white` text, it may disappear. Consider using dynamic color based on theme or a stronger text‑shadow.

**Options:**
1. Use `color: var(--text‑primary)` and rely on text‑shadow for contrast.
2. Add a semi‑transparent underline or background only for light theme.
3. Keep background removal as requested; accept that readability may decrease in some edge cases.

**Decision:** Start with `white` text and dark text‑shadow, which works on both light and dark images because the shadow creates contrast. Test thoroughly.

### Step 4: Validation Steps

1. **Type check:**
   ```bash
   docker run --rm --network host -v "$(pwd)":/app -w /app node:24-alpine npm run check
   ```
   Expected: 0 errors, 0 warnings.

2. **Short test suite:**
   ```bash
   docker-compose -f docker-compose.test.yml up --build playwright
   ```
   Expected: all 32 tests pass (no regression).

3. **Manual verification:**
   - Start dev server with mock adapter.
   - Navigate to a gallery with author names.
   - Verify author badges appear without a box, text directly over image.
   - Switch between grid and list views.
   - Toggle light/dark theme (if implemented) and verify readability.
   - Test on mobile viewport (touch target size).

## Success Criteria

1. Author badges in grid view show text without background or backdrop‑filter.
2. Author text in list view shows without background.
3. Text remains readable across typical thumbnail backgrounds (add text‑shadow if needed).
4. No regression in existing layout or touch target sizing.
5. Type check passes, short test suite passes.

## Files to Modify

1. `src/components/gallery/MediaItem.svelte` – `.badge.author` CSS.
2. `src/components/gallery/MediaListRow.svelte` – `.author` CSS.

**No changes required in:**
- `src/stores/` (author data flow unchanged)
- `APPLICATION_SPEC.md`
- `STATUS.md` (will be updated after implementation)

## Potential Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Text becomes unreadable on similar‑color backgrounds | Use text‑shadow and possibly a dynamic color based on image luminance (out of scope). Start with strong shadow. |
| Touch target size shrinks because padding removed | Keep existing padding; background removal does not affect box dimensions. |
| Light theme visibility poor | Test with light theme; adjust color to `var(--text‑primary)` with shadow if needed. |

## Estimated Effort

**Low** – CSS‑only changes, no logic modifications.

## Blockers

None identified.

## Notes

- Follow existing CSS variable naming conventions.
- Update `STATUS.md` after implementation with validation results.
- Commit with message `style: remove author thumbnail background, use text overlay`.