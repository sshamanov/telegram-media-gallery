# Task 54: Focus Management Improvements Implementation Plan

> **Status:** completed

Task implemented as part of Clever Island Block 2.
> **Date:** 2026-04-17
> **Based on:** Clever Island plan Block 2.5 requirements
> **Parent Plan:** `.kilo/plans/1776410435637-clever-island.md`

---

## Executive Summary

Task 54 enhances keyboard accessibility by implementing focus trapping in modal dialogs (forward sheet, upload sheet, dialog picker) and ensuring focus returns to the triggering element when a modal closes. It also strengthens custom focus styles for better visual indication.

## Current State Assessment

**Existing focus styles** (`src/app.css` lines 186‑205):
- Custom `:focus‑visible` styles for buttons, links, and `[tabindex]` elements using `--border‑focus` color
- `.button:focus‑visible` has `outline: 2px solid var(--border‑focus)`
- `button:focus:not(:focus‑visible)` rule removes default focus for mouse users

**Gaps identified:**
1. **No focus trapping** in modals:
   - `DialogPicker` (forward sheet)
   - Upload progress sheet (in `GalleryGrid`)
   - Any other modal/overlay that appears
2. **Focus does not return** to trigger element after modal closes
3. **Missing focus indicators** for some custom interactive elements (e.g., media cards in selection mode)
4. **Keyboard navigation within modals** may be incomplete (Tab order, Escape to close)

## Implementation Details

### 1. Focus Trapping in Modals
**Principle:** When a modal opens, focus should move to the first focusable element inside the modal. Tab key should cycle only within the modal. Shift+Tab should reverse cycle. Escape should close the modal and return focus to the trigger.

**Target modals:**
1. **DialogPicker** (`src/components/gallery/DialogPicker.svelte`)
   - Currently: overlay `div` has `tabindex="0"` and `role="button"` (accessibility violation)
   - Required: trap focus within `.dialog‑picker‑modal`, manage initial focus to search input or first dialog item
2. **Upload progress sheet** (in `GalleryGrid.svelte`, when `$uploadQueueState.active`)
   - Currently: no focus management
   - Required: trap focus within `.upload‑panel`, initial focus to cancel button or close area
3. **Forward progress sheet** (in `GalleryGrid.svelte`, when `$forwardQueueState.active`)
   - Currently: no focus management
   - Required: trap focus within `.forward‑panel`, initial focus to cancel button

**Implementation approach:**
- Create a reusable focus‑trap utility in `src/lib/dom/focus‑trap.ts`
- Use `focus‑trap‑js` pattern: on mount, store currently focused element, move focus to first focusable element in modal, add keydown listener for Tab/Escape
- On unmount, restore focus to stored element
- Ensure modal container has `tabindex="-1"` and appropriate `aria‑modal="true"`

### 2. Focus Return to Trigger
**Principle:** When a modal closes (via button, Escape, or overlay click), focus must return to the element that opened it.

**Implementation:**
- Store trigger element reference when opening modal
- Use `triggerElement.focus()` on close
- Handle edge cases: trigger may be removed from DOM (fallback to reasonable alternative)

### 3. Enhanced Focus Styles
**Current custom styles are good but may need extension:**
- Ensure `:focus‑visible` styles apply to all interactive elements (including custom buttons without `.button` class)
- Add focus indicator for media cards in keyboard navigation mode (`.media‑card.focused` already exists)
- Verify contrast ratio of `--border‑focus` against background meets WCAG AA

**Potential additions:**
```css
/* Ensure all clickable cards show focus */
[role="button"]:focus‑visible,
.dialog‑item:focus‑visible {
  outline: 2px solid var(--border‑focus);
  outline‑offset: 2px;
}

/* Stronger focus for modal containers */
.modal:focus‑visible {
  outline: 3px solid var(--border‑focus);
}
```

### 4. Component‑Specific Implementation

**DialogPicker.svelte:**
- Remove `role="button"` and `tabindex` from overlay `div` (fix accessibility violation)
- Add `aria‑modal="true"` and `role="dialog"` to modal container (already present)
- Implement focus trap: initial focus to search input
- Escape key closes picker (already handled in `handleOverlayKeydown`)
- On close, return focus to the "Forward" button that opened it

**GalleryGrid.svelte (upload/forward panels):**
- Add `aria‑live="polite"` for progress announcements
- Trap focus within panel when active
- Escape key cancels operation (already via cancel button)
- On cancel/complete, return focus to selection toolbar or appropriate context

**MediaItem.svelte & GalleryGrid.svelte (keyboard navigation):**
- Existing `.media‑card.focused` class shows outline (good)
- Ensure focus moves correctly with arrow keys (already implemented in Block 3)

### 5. Utility Function: `src/lib/dom/focus‑trap.ts`
```typescript
export function trapFocus(element: HTMLElement, onEscape?: () => void): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  
  // Move focus to first focusable element in the trap
  const focusable = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length > 0) {
    (focusable[0] as HTMLElement).focus();
  } else {
    element.focus();
  }
  
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }
    
    if (event.key !== 'Tab') return;
    
    const focusableElements = Array.from(
      element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];
    
    if (focusableElements.length === 0) return;
    
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  };
  
  element.addEventListener('keydown', handleKeydown);
  
  return () => {
    element.removeEventListener('keydown', handleKeydown);
    previouslyFocused?.focus();
  };
}
```

## Success Criteria

1. **Focus trapping:** Tab key cycles only within open modal; cannot tab to background elements.
2. **Focus return:** After modal closes, focus returns to element that opened it.
3. **Escape closure:** Escape key closes modal (where appropriate).
4. **Visual focus:** All interactive elements show clear focus indicator.
5. **No regression:** Existing keyboard navigation (Block 3) continues to work.
6. **Validation:** Type check and short test suite pass.

## Files to Modify

- `src/lib/dom/focus‑trap.ts` – new utility for focus trapping
- `src/components/gallery/DialogPicker.svelte` – implement focus trap, fix overlay accessibility
- `src/components/gallery/GalleryGrid.svelte` – add focus trap to upload/forward panels
- `src/app.css` – extend focus styles if needed
- `src/components/gallery/MediaItem.svelte` – ensure focus styles apply
- `src/components/dialogs/DialogItem.svelte` – ensure focus styles apply

## Risks & Mitigations

- **Breaking existing keyboard navigation:** Test thoroughly with arrow‑key navigation in gallery.
- **Accessibility regression:** Keep `aria‑modal`, `role="dialog"` attributes intact.
- **Focus trap too restrictive:** Ensure users can still close modal via click outside (if designed).
- **Browser compatibility:** `:focus‑visible` is well‑supported; fallback to `:focus` if needed.

## Dependencies

- None; this task is self‑contained.

## Validation Requirements

### Mandatory after implementation:
- `docker run --rm --network host -v "$(pwd)":/app -w /app node:24‑alpine npm run check`
- `docker‑compose -f docker‑compose.test.yml up --build playwright`
- Manual keyboard testing:
  1. Open DialogPicker via Forward button, verify Tab cycles within, Escape closes, focus returns
  2. Start upload/forward, verify focus trapped in progress panel
  3. Navigate gallery with arrow keys, verify focus indicator visible
- Update `STATUS.md` with completion evidence and commit hash

---

**Next Step:** Implement focus‑trap utility and apply to DialogPicker.