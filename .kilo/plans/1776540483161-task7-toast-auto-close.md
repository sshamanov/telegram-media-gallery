# Task 7: Toast Auto‑Close Adjustment

**Goal:** Change toast auto‑close timeout from 3 s to 1 s default, keep dismissible behavior, ensure error toasts stay until manually dismissed.

**Plan ID:** 1776540483161-task7-toast-auto-close  
**Created:** 2026-04-18 21:28:03 +02:00  
**Status:** pending  

## Overview

Current toast implementation (`src/stores/ui.ts`) automatically dismisses dismissible non‑error toasts after 3 s. Task 7 requests a 1 s default. The change should maintain backward compatibility (dismissible flag, error toasts never auto‑close) and not affect existing UI.

## Execution Order

### Phase 0: Examine Current Implementation
1. Read `src/stores/ui.ts` `pushToast` function.
2. Read `src/components/ui/Toast.svelte` component.
3. Identify all call sites of `pushToast` to ensure no side effects.

### Phase 1: Adjust Timeout Constant
1. Update `src/stores/ui.ts` line 14: replace `3000` with `1000`.
2. Optionally make the timeout configurable via a constant (`const TOAST_AUTO_CLOSE_MS = 1000`).
3. Keep the condition `partial.dismissible && partial.kind !== 'error'` unchanged.

### Phase 2: Verify Error Toasts Behavior
1. Confirm error toasts have `dismissible: true` but `kind: 'error'`; they should not auto‑close.
2. Check that any other toast kinds (`success`, `warning`, `info`) respect the new timeout.

### Phase 3: Validation
1. Type check: `npm run check`.
2. Short test suite: ensure existing toast‑related tests pass.
3. Manual verification:
   - Trigger a success toast (e.g., copy link) – should disappear after ~1 s.
   - Trigger an error toast – should stay until dismissed.
   - Trigger a dismissible info toast – should auto‑close.

## Detailed Steps

### Step 0: Examine Current Implementation (File: `src/stores/ui.ts`)

**Current code:**
```ts
export function pushToast(partial: Omit<ToastMessage, 'id'>): void {
  const id = crypto.randomUUID()
  toasts.update((items) => [...items, { ...partial, id }])

  if (partial.dismissible && partial.kind !== 'error') {
    window.setTimeout(() => dismissToast(id), 3000)
  }
}
```

**Notes:**
- `ToastMessage` type defined in `src/types/telegram.ts`.
- The `dismissible` property is optional; defaults to `true` in most call sites.
- Error toasts are excluded from auto‑close.

**Call sites:** Search for `pushToast` across the codebase to ensure no caller depends on the exact 3 s timing.

### Step 1: Adjust Timeout Constant

**Modification:**
1. Add a constant at the top of the file:
   ```ts
   const TOAST_AUTO_CLOSE_MS = 1000 // 1 second
   ```
2. Replace `3000` with `TOAST_AUTO_CLOSE_MS`.
3. Optionally export the constant for tests (not required).

**Updated function:**
```ts
export function pushToast(partial: Omit<ToastMessage, 'id'>): void {
  const id = crypto.randomUUID()
  toasts.update((items) => [...items, { ...partial, id }])

  if (partial.dismissible && partial.kind !== 'error') {
    window.setTimeout(() => dismissToast(id), TOAST_AUTO_CLOSE_MS)
  }
}
```

### Step 2: Verify Error Toasts Behavior

**Check call sites:** Use grep to find `pushToast` calls with `kind: 'error'`. Ensure they have `dismissible: true` (or omit, default true). Example from `src/lib/telegram/mtcute.ts`:
```ts
pushToast({ kind: 'error', text: 'Failed to load dialogs', dismissible: true })
```
This toast will **not** auto‑close because `kind === 'error'`.

### Step 3: Validation Steps

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
   - Start dev server (`npm run dev`).
   - Trigger a success toast (e.g., copy link in viewer).
   - Observe it disappears after ~1 s.
   - Trigger an error toast (e.g., simulate failed dialog load).
   - Verify it remains until close button clicked.
   - Repeat with a warning/info toast.

## Success Criteria

1. Toast auto‑close timeout reduced from 3 s to 1 s.
2. Error toasts never auto‑close (remain until manually dismissed).
3. No regression in existing toast behavior (dismissible flag respected).
4. Type check passes (0 errors, 0 warnings).
5. Short test suite passes (32/32).

## Files to Modify

1. `src/stores/ui.ts` – change timeout constant.

**No changes required in:**
- `src/components/ui/Toast.svelte`
- `src/types/telegram.ts`
- `APPLICATION_SPEC.md`
- `STATUS.md` (will be updated after implementation)

## Potential Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Users may miss toasts with shorter timeout | 1 s is still noticeable; dismissible toasts can be manually extended later if needed. |
| Error toasts accidentally auto‑close | Verify condition `kind !== 'error'` is preserved. |
| Test suite depends on exact timing | Existing tests should not rely on specific timeout values. |

## Estimated Effort

**Low** – single constant change, minimal validation.

## Blockers

None identified.

## Notes

- Follow existing code patterns (no extra refactoring unless required).
- Update `STATUS.md` after implementation with validation results.
- Commit with message `fix: reduce toast auto‑close timeout to 1 second`.