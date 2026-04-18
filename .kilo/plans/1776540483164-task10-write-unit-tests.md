# Task 10: Write Unit Tests

**Goal:** Set up a unit‑test framework (vitest) and add comprehensive unit tests for recently implemented functionality (Tasks 1–6, refactored modules).

**Plan ID:** 1776540483164-task10-write-unit-tests  
**Created:** 2026-04-18 21:28:03 +02:00  
**Status:** deferred  

## Overview

The project currently relies solely on Playwright end‑to‑end tests for validation. Unit tests are missing, making it difficult to verify individual functions and modules in isolation. This task will:

1. **Set up vitest** with Svelte 5 support and a sensible configuration.
2. **Write unit tests** for the caching logic (Task 6), bug fixes (Tasks 1–5), and refactored modules (Task 9).
3. **Integrate** unit tests into the CI workflow (run alongside existing Playwright tests).
4. **Ensure** test coverage does not regress existing functionality.

## Execution Order

### Phase 0: Research & Planning
1. Examine existing Playwright test structure to avoid overlap.
2. Decide on unit‑test scope: focus on pure functions, adapter methods, store utilities, component logic (without UI).
3. Choose supporting libraries (`@vitest/ui`, `@testing-library/svelte`, `jsdom`).

### Phase 1: Setup Vitest
1. Add dev dependencies: `vitest`, `@vitest/ui`, `@testing-library/svelte`, `@testing-library/jest‑dom`, `jsdom`.
2. Create `vitest.config.ts` with Svelte 5 and Vite integration.
3. Update `package.json` scripts: `test:unit`, `test:unit:watch`, `test:unit:coverage`.
4. Verify basic setup with a dummy test.

### Phase 2: Test Cache Logic (Task 6)
1. Test `readCachedDialogs` / `writeCachedDialogs` / `clearDialogCache` (IndexedDB mocking).
2. Test cache‑first behavior in `mtcute.ts` and `mock.ts` (mock Telegram client).
3. Test cache invalidation (logout, session expiry, forceRefresh).

### Phase 3: Test Bug Fixes (Tasks 1–5)
1. **Scroll position preservation** – test `scrollPositions` store helpers.
2. **Grid columns button** – test `settings.gridColumns` updates and desktop detection.
3. **Masonry thumbnail sizing** – test aspect‑ratio calculations.
4. **Settings title persistence** – test route‑cleanup logic.
5. **Video preview exit** – test viewer close path (mock PhotoSwipe).

### Phase 4: Test Refactored Modules (Task 9)
1. Test extracted helper functions (`mtcute‑helpers.ts`, `mock‑data.ts`, `cache‑first.ts`).
2. Test gallery utilities (`masonry.ts`, `keyboard‑navigation.ts`, `selection‑helpers.ts`).
3. Test viewer utilities (`photoswipe‑integration.ts`, `video‑player.ts`, `object‑url‑lifecycle.ts`).

### Phase 5: Integration & Validation
1. Run unit tests alongside existing Playwright tests.
2. Ensure CI passes (type check, short suite, unit tests).
3. Generate coverage report (optional).

## Detailed Steps

### Step 0: Research & Planning

**Existing test structure:**
- Playwright e2e tests in `tests/e2e/` (`short/`, `long/`).
- Mock adapter used for all tests (`VITE_USE_MOCK_ADAPTER=true`).

**Unit‑test scope:**
- Pure functions (no side effects).
- Adapter methods (mock Telegram client).
- Store utilities (state updates).
- Component logic (tested via `@testing-library/svelte`).
- **Exclude** UI rendering and browser‑specific behavior (already covered by Playwright).

**Libraries:**
- `vitest` – test runner.
- `@vitest/ui` – web UI.
- `@testing-library/svelte` – Svelte component testing.
- `jsdom` – DOM emulation.
- `@testing-library/jest‑dom` – DOM assertions.

### Step 1: Setup Vitest

**1.1 Install dependencies:**
```bash
npm install --save-dev vitest @vitest/ui @testing-library/svelte @testing-library/jest-dom jsdom
```

**1.2 Create `vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{spec,test}.{ts,js}'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

**1.3 Create `vitest.setup.ts`:**
```ts
import '@testing-library/jest-dom'
// Global mocks if needed
```

**1.4 Update `package.json` scripts:**
```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:coverage": "vitest run --coverage",
    "test:all": "npm run test:unit && npm run test:short && npm run test:long"
  }
}
```

**1.5 Verify setup:**
Create `src/lib/example.test.ts`:
```ts
import { expect, test } from 'vitest'

test('example', () => {
  expect(1 + 1).toBe(2)
})
```
Run `npm run test:unit` – should pass.

### Step 2: Test Cache Logic

**2.1 Mock IndexedDB:** Use `fake-indexeddb` or mock the `indexeddb.ts` functions directly. Since the cache functions are asynchronous, we can mock the underlying `IDBRequest`.

**Approach:** Create a test‑specific mock in `src/lib/cache/__tests__/indexeddb.test.ts` that substitutes `withStore` with an in‑memory store.

**Test cases:**
- `writeCachedDialogs` stores data.
- `readCachedDialogs` retrieves stored data.
- `clearDialogCache` removes data.
- TTL expiration (timestamp check).

**2.2 Mock mtcute adapter:** Use vi.spyOn to mock `client.iterDialogs` and verify cache‑first behavior.

**Test cases:**
- First call fetches from network, writes cache.
- Second call within TTL returns cached data.
- `forceRefresh: true` bypasses cache.
- Cache cleared on logout.

**2.3 Mock mock adapter:** Similar tests with artificial delay.

### Step 3: Test Bug Fixes

**3.1 Scroll position preservation:** Test `src/stores/gallery.ts` `scrollPositions` store (set/get/clear). Use Svelte store testing utilities.

**3.2 Grid columns button:** Test `src/stores/settings.ts` `gridColumns` updates and `src/lib/desktop‑detection.ts` (if exists). Mock window width.

**3.3 Masonry thumbnail sizing:** Test `src/components/gallery/MediaItem.svelte` aspect‑ratio calculation (function extracting width/height). Use component testing.

**3.4 Settings title persistence:** Test route‑cleanup effect in `src/App.svelte` (difficult). May be better covered by e2e; skip unit test.

**3.5 Video preview exit:** Test `src/components/gallery/ViewerWrapper.svelte` close path (mock `pswp.close()`). Use component testing.

### Step 4: Test Refactored Modules

**4.1 Extracted helpers:** Each new utility module should have a corresponding test file (e.g., `mtcute‑helpers.test.ts`).

**4.2 Gallery utilities:**
- `masonry.ts` – test layout detection.
- `keyboard‑navigation.ts` – test key‑event handling.
- `selection‑helpers.ts` – test selection logic.

**4.3 Viewer utilities:**
- `photoswipe‑integration.ts` – test initialization/cleanup.
- `video‑player.ts` – test play/pause, fullscreen.
- `object‑url‑lifecycle.ts` – test URL creation/revocation.

### Step 5: Integration & Validation

**5.1 Run full test suite:**
```bash
npm run test:unit
npm run test:short
```
Both must pass.

**5.2 CI integration:** Ensure `docker‑compose.test.yml` also runs unit tests (add a `unit‑test` service or run inside the playwright container). Simpler: run unit tests in the same Docker container as type check.

**5.3 Coverage report:** Optional; generate with `--coverage` and track threshold.

## Success Criteria

1. Vitest configured and working (dummy test passes).
2. Unit tests exist for:
   - Dialog metadata caching (read/write/clear, TTL, forceRefresh).
   - Scroll position store.
   - Grid columns setting.
   - Masonry aspect‑ratio helpers.
   - Viewer close path (mock).
   - All extracted utility modules.
3. All unit tests pass.
4. Existing Playwright tests continue to pass (no regression).
5. Type check passes.
6. Unit‑test command integrated into `npm run test:all`.

## Files to Modify

**New files:**
- `vitest.config.ts`
- `vitest.setup.ts`
- `src/lib/example.test.ts` (temporary)
- Test files for each target module (`*.test.ts`).

**Modified files:**
- `package.json` (add dev dependencies, scripts)
- `.gitignore` (add coverage directory)
- `STATUS.md` (update after implementation)

**No changes required in:**
- Production source code (unless test‑only mocks).
- `APPLICATION_SPEC.md`
- `AGENTS.md`

## Potential Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Unit tests interfere with existing Playwright tests | Keep test environments separate; run unit tests in Node, e2e in browser. |
| Mocking IndexedDB is complex | Use `fake‑indexeddb` library or mock the `indexeddb.ts` module with vi.mock. |
| Svelte 5 component testing not yet stable | Rely on function‑level tests; avoid component tests where possible. |
| Increased CI time | Run unit tests in parallel; cache dependencies. |

## Estimated Effort

**High** – setting up a new test framework and writing comprehensive tests is substantial.

## Blockers

- Need to verify compatibility of `@testing-library/svelte` with Svelte 5.
- May require additional configuration for Vite aliases.

## Notes

- Follow existing code style for tests (Arrow functions, `describe`/`it` or `test`).
- Use `vi.mock` for external dependencies (`@mtcute/web`, `photoswipe`).
- Update `STATUS.md` after each phase.
- Commit with messages `test: setup vitest`, `test: add unit tests for cache logic`, etc.