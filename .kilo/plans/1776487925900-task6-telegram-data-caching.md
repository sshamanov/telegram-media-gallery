# Task 6: Implement Telegram Data Caching for Faster Reloads

**Goal:** Implement cache‑first strategy for dialog metadata to make app reloads instant (<1 s) instead of waiting for Telegram API every time.

**Plan ID:** 1776487925900-task6-telegram-data-caching  
**Created:** 2026-04-18 20:12:33 +02:00  
**Status:** pending  

## Overview

Current state:
- Dialog snapshot system (`src/stores/dialogs.ts`) persists sanitized dialog data to localStorage for offline bootstrap only.
- Media cache (`src/lib/cache/indexeddb.ts`) stores thumbnails and full media, but no dialog metadata.
- App startup calls `getCurrentAdapter().getDialogs()` directly, causing a network round‑trip even when online.

Requirement: add IndexedDB‑based dialog metadata cache with 5‑minute TTL, checked before every `getDialogs` call.  
Success: app reload shows cached dialogs instantly (<1 s) instead of waiting for Telegram API.

## Execution Order

### Phase 0: Update TelegramAdapter Interface
1. Update `src/lib/telegram/adapter.ts` – add `forceRefresh?: boolean` to `getDialogs` options.

### Phase 1: Extend IndexedDB Schema
2. Update `src/lib/cache/indexeddb.ts` – increment DB version, add `dialog-metadata` store, expose read/write/clear functions.

### Phase 2: Add Cache‑First Logic to Real Adapter
3. Update `src/lib/telegram/mtcute.ts` – modify `getDialogs` to check cache first, respect TTL, write back after fetch.

### Phase 3: Add Cache‑First Logic to Mock Adapter
4. Update `src/lib/telegram/mock.ts` – same cache‑first logic for consistency.

### Phase 4: Integrate Cache Clearance with Session Lifecycle
5. Update `src/stores/telegram.ts` – clear dialog cache on logout and session expiry.
6. Update `src/stores/dialogs.ts` – optionally expose cache‑clear helper.

### Phase 5: Update Refresh Logic in DialogList Component
7. Update `src/components/dialogs/DialogList.svelte` – separate `loadDialogs` and `refreshDialogs`.

### Phase 6: Validation
8. Run type check, short test suite, manual verification of caching behavior.

## Detailed Steps

### Step 0: Update TelegramAdapter Interface (File: `src/lib/telegram/adapter.ts`)

**Line‑by‑line modifications:**

1. **Line 17**: Update `getDialogs` signature to include `forceRefresh?: boolean`:
   ```ts
   getDialogs(opts?: { limit?: number; offsetDate?: number; forceRefresh?: boolean }): Promise<Dialog[]>
   ```

**Validation:** Type check passes; no other files need immediate changes.

### Step 1: Extend IndexedDB Schema (File: `src/lib/cache/indexeddb.ts`)

**Line‑by‑line modifications:**

1. **Line 2**: Increment `DB_VERSION` from `1` to `2`.
2. **Line 3‑4**: Add new store constant:
   ```ts
   const DIALOG_METADATA = 'dialog-metadata'
   ```
   Update `StoreName` type (line 6) to include `typeof DIALOG_METADATA`:
   ```ts
   type StoreName = typeof THUMBS | typeof FULL | typeof DIALOG_METADATA
   ```
3. **Lines 21‑29** (`onupgradeneeded`): Add store creation:
   ```ts
   if (!db.objectStoreNames.contains(DIALOG_METADATA)) {
     db.createObjectStore(DIALOG_METADATA, { keyPath: 'id' })
   }
   ```
4. **After line 137**: Add new cache functions:
   ```ts
   export interface DialogCacheRow {
     id: 'dialogs'  // single entry for the whole list
     dialogs: Dialog[]
     updatedAt: number
   }

   export async function readCachedDialogs(): Promise<DialogCacheRow | null> {
     return withStore<DialogCacheRow | null>(DIALOG_METADATA, 'readonly', (store, resolve) => {
       const request = store.get('dialogs')
       request.onsuccess = () => resolve((request.result as DialogCacheRow | undefined) ?? null)
       request.onerror = () => resolve(null)
     })
   }

   export async function writeCachedDialogs(dialogs: Dialog[]): Promise<void> {
     return withStore(DIALOG_METADATA, 'readwrite', (store, resolve, reject) => {
       const request = store.put({
         id: 'dialogs',
         dialogs,
         updatedAt: Date.now(),
       } satisfies DialogCacheRow)
       request.onsuccess = () => resolve(undefined)
       request.onerror = () => reject(request.error ?? new Error('Failed to write dialog cache'))
     })
   }

   export async function clearDialogCache(): Promise<void> {
     await withStore(DIALOG_METADATA, 'readwrite', (store, resolve, reject) => {
       const request = store.clear()
       request.onsuccess = () => resolve(undefined)
       request.onerror = () => reject(request.error ?? new Error('Failed to clear dialog cache'))
     })
   }
   ```
   **Note:** Import `Dialog` from `../../types/telegram`.

**Validation:** Type check passes, no runtime errors.

### Step 2: Add Cache‑First Logic to Real Adapter (File: `src/lib/telegram/mtcute.ts`)

**Line‑by‑line modifications:**

1. **Add import** at top (after existing imports):
   ```ts
   import { readCachedDialogs, writeCachedDialogs } from '../cache/indexeddb'
   ```
2. **Modify `getDialogs` method (lines 359‑376)**:
   - Wrap existing implementation with cache‑first logic.
   - TTL: 5 minutes = 300 000 ms.
   - The `forceRefresh` option is now part of the interface (updated in Step 0).

   Proposed new implementation:
    ```ts
    async getDialogs(_opts?: { limit?: number; offsetDate?: number; forceRefresh?: boolean }): Promise<Dialog[]> {
      const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
      const now = Date.now()

      // Helper to filter dialogs by offsetDate and limit, deduplicate
      const filterDialogs = (allDialogs: Dialog[], limit: number, offsetDate: number): Dialog[] => {
        const seen = new Set<string>()
        const filtered: Dialog[] = []
        for (const dialog of allDialogs) {
          if (dialog.lastMessageDate && dialog.lastMessageDate <= offsetDate) continue
          if (seen.has(dialog.id)) continue
          seen.add(dialog.id)
          filtered.push(dialog)
          if (filtered.length >= limit) break
        }
        return filtered
      }

      // 1. Try cache unless forceRefresh is true
      if (!_opts?.forceRefresh) {
        const cached = await readCachedDialogs()
        if (cached && now - cached.updatedAt < CACHE_TTL) {
          debugLog('mtcute:getDialogs returning cached data', { count: cached.dialogs.length })
          const limit = _opts?.limit ?? Infinity
          const offsetDate = _opts?.offsetDate ?? 0
          return filterDialogs(cached.dialogs, limit, offsetDate)
        }
      }

      // 2. Fetch fresh data from Telegram (always fetch all dialogs for cache)
      const client = this.getClient()
      const allDialogs: Dialog[] = []
      const seen = new Set<string>()
      for await (const dialog of client.iterDialogs({ limit: Infinity, offsetDate: 0 })) {
        const mapped = mapPeer(dialog.peer)
        mapped.lastMessageDate = dialog.lastMessage?.date.getTime() ?? null
        if (seen.has(mapped.id)) continue
        seen.add(mapped.id)
        allDialogs.push(mapped)
      }

      // 3. Update cache (ignore errors)
      try {
        await writeCachedDialogs(allDialogs)
      } catch (error) {
        debugWarn('Failed to write dialog cache', error)
      }

      // 4. Return filtered result according to opts
      const limit = _opts?.limit ?? Infinity
      const offsetDate = _opts?.offsetDate ?? 0
      return filterDialogs(allDialogs, limit, offsetDate)
    }
    ```

**Validation:** Type check passes; cache hit/miss can be verified with debug logs.

### Step 3: Add Cache‑First Logic to Mock Adapter (File: `src/lib/telegram/mock.ts`)

**Line‑by‑line modifications:**

1. **Add import** at top:
   ```ts
   import { readCachedDialogs, writeCachedDialogs } from '../cache/indexeddb'
   ```
2. **Modify `getDialogs` method (lines 259‑268)**:
   - Same cache‑first pattern, but keep the artificial delay only when fetching fresh data.
   - If cache hit, return immediately (no delay).
   - If cache miss, keep the `await this.delay(800)` before loading fresh data.

   Proposed implementation:
    ```ts
    async getDialogs(opts?: { limit?: number; offsetDate?: number; forceRefresh?: boolean }): Promise<Dialog[]> {
      const CACHE_TTL = 5 * 60 * 1000
      const now = Date.now()

      // Helper to filter dialogs using mock's existing logic
      const filterDialogs = (allDialogs: Dialog[], limit: number, offsetDate: number): Dialog[] => {
        return allDialogs
          .filter(dialog => !dialog.lastMessageDate || dialog.lastMessageDate > offsetDate)
          .slice(0, limit)
      }

      if (!opts?.forceRefresh) {
        const cached = await readCachedDialogs()
        if (cached && now - cached.updatedAt < CACHE_TTL) {
          debugLog('mock:getDialogs returning cached data', { count: cached.dialogs.length })
          const limit = opts?.limit ?? cached.dialogs.length
          const offsetDate = opts?.offsetDate ?? 0
          return filterDialogs(cached.dialogs, limit, offsetDate)
        }
      }

      // Cache miss: fetch fresh data with artificial delay
      await this.delay(800)
      const allDialogs = await loadDialogs()

      // Store all dialogs in cache (ignore errors)
      try {
        await writeCachedDialogs(allDialogs)
      } catch (error) {
        debugWarn('Mock adapter: failed to write dialog cache', error)
      }

      // Return filtered result according to opts
      const limit = opts?.limit ?? allDialogs.length
      const offsetDate = opts?.offsetDate ?? 0
      return filterDialogs(allDialogs, limit, offsetDate)
    }
    ```

**Validation:** Type check passes; mock short tests still pass.

### Step 4: Integrate Cache Clearance with Session Lifecycle

**File: `src/stores/telegram.ts`**

1. **Add import** at top:
   ```ts
   import { clearDialogCache } from '../lib/cache/indexeddb'
   ```
2. **Modify `switchToMockAdapter` (lines 54‑75)** – add cache clearance after `clearDialogSnapshot()`:
   ```ts
   clearDialogSnapshot()
   await clearDialogCache()  // new line
   resetDialogsState()
   ```
   **Note:** `clearDialogCache` returns a `Promise`, but `switchToMockAdapter` is not `async`. We can either make it async or fire‑and‑forget. Safer: make it async and update callers (none external). Let's keep fire‑and‑forget with `void`:
   ```ts
   clearDialogSnapshot()
   void clearDialogCache()
   resetDialogsState()
   ```
3. **Modify `handleSessionExpired` (lines 138‑147)** – same addition:
   ```ts
   clearDialogSnapshot()
   void clearDialogCache()
   resetDialogsState()
   ```

**File: `src/stores/dialogs.ts`**

Optional: add `clearDialogCache` to exported functions. Not required for core flow.

### Step 5: Update Refresh Logic in DialogList Component

**File: `src/components/dialogs/DialogList.svelte`**

Currently `refreshDialogs()` calls `getCurrentAdapter().getDialogs()` directly. To force a refresh (bypass cache), we need to pass `forceRefresh: true`.

1. **Modify `refreshDialogs` function (lines 59‑70)**:
   ```ts
   async function refreshDialogs(): Promise<void> {
     if ($isOffline) {
       return
     }

     try {
       const dialogs = await getCurrentAdapter().getDialogs({ forceRefresh: true })
       setDialogs(dialogs)
     } catch {
       pushToast({ kind: 'error', text: 'Failed to refresh dialogs', dismissible: true })
     }
   }
   ```

   **Note:** The `forceRefresh` property will be ignored by adapters that don't expect it (old interface). That's fine because the cache layer is inside the adapter implementations, not the interface. However, we must ensure both adapters accept the property. Since we updated both, it's safe.

**Tab‑switch refresh:** The `switchTab` function (lines 72‑75) currently calls `refreshDialogs()` on every tab click. That would force a refresh each time, defeating cache. Change to call `refreshDialogs()` only when `$isOffline` is false, but keep cache‑first behavior (i.e., don't pass `forceRefresh`). However, the current `refreshDialogs` will now pass `forceRefresh: true`. We need two separate functions: one for manual refresh (cache bypass), one for silent refresh (cache‑first). Let's adjust:

   - Keep `refreshDialogs` as manual refresh (force bypass).
   - Create a separate `loadDialogs` that uses default cache‑first behavior (no `forceRefresh`).
   - `switchTab` should call `loadDialogs`, not `refreshDialogs`.

   But `switchTab` currently calls `refreshDialogs` to ensure data is fresh when switching tabs. With cache‑first, we can rely on the cache being fresh enough (5 min). If user wants latest data, they can use the manual refresh button (which we haven't added yet). However, there is no UI refresh button currently. The tab switch acts as implicit refresh. We can keep it as cache‑first (no force) to avoid unnecessary network calls.

   Implementation:
   ```ts
   async function loadDialogs(forceRefresh = false): Promise<void> {
     if ($isOffline) {
       return
     }

     try {
       const dialogs = await getCurrentAdapter().getDialogs(forceRefresh ? { forceRefresh: true } : undefined)
       setDialogs(dialogs)
     } catch {
       pushToast({ kind: 'error', text: 'Failed to load dialogs', dismissible: true })
     }
   }

   async function refreshDialogs(): Promise<void> {
     await loadDialogs(true)
   }

   function switchTab(nextTab: 'galleries' | 'groups' | 'chats'): void {
     tab = nextTab
     void loadDialogs(false)  // cache‑first
   }
   ```

   This keeps backward compatibility and adds explicit refresh capability.

**UI refresh button:** Not required for this task, but could be added later.

### Step 5b: Clear cache on logout

**File:** `src/components/dialogs/DialogList.svelte`

The logout function (lines 81‑90) currently clears session and dialog snapshot but not the dialog cache. Add cache clearance to ensure dialogs from a previous user are not shown after login.

1. **Add import** at top (after other imports):
   ```ts
   import { clearDialogCache } from '../../lib/cache/indexeddb'
   ```

2. **Modify `logout` function**:
   ```ts
   async function logout(): Promise<void> {
     await getCurrentAdapter().logout()
     localStorage.removeItem('session')
     localStorage.removeItem('phone')
     clearDialogSnapshot()
     void clearDialogCache()  // new line
     resetDialogsState()
     authState.set('idle')
     session.set({ session: null })
     pushToast({ kind: 'info', text: 'Session cleared', dismissible: true })
   }
   ```

**Note:** `clearDialogCache` returns a `Promise`. Since `logout` is already `async`, we could `await` it, but logging out doesn't need to wait for cache clearance. Use `void` to fire‑and‑forget.

### Step 6: Validation Steps

1. **Type check:** `docker run --rm --network host -v "$(pwd)":/app -w /app node:24-alpine npm run check`
   - Expected: 0 errors, 0 warnings.

2. **Short test suite:** `docker-compose -f docker-compose.test.yml up --build playwright`
   - Expected: all 32 tests pass.

3. **Manual verification:**
   - Start dev server with mock adapter (`VITE_USE_MOCK_ADAPTER=true`).
   - Log in, observe dialogs load (first time: ~800 ms delay).
   - Reload page (Cmd+R). Dialogs should appear instantly (<100 ms) because cache is used.
   - Wait 5 minutes (or manually clear IndexedDB), reload again – should see delay.
   - Switch tabs – should use cache (no delay).
   - Log out and back in – cache should be cleared.

4. **Real adapter verification:** (Optional) Test with real Telegram credentials to ensure caching works without breaking auth flows.

## Cache Structure Design

**IndexedDB store:** `dialog-metadata`
- Key path: `id` (string)
- Single entry with `id: 'dialogs'`
- Value shape:
  ```ts
  {
    id: 'dialogs',
    dialogs: Dialog[],  // full array of sanitized dialog objects
    updatedAt: number   // milliseconds since epoch
  }
  ```

**TTL:** 5 minutes (300 000 ms). After that, cache is considered stale and triggers a fresh fetch.

**Invalidation triggers:**
- Logout (`switchToMockAdapter`, `handleSessionExpired`)
- Manual refresh (`forceRefresh: true`)
- Automatic after TTL expiry

**Integration with existing snapshot system:**
- The localStorage snapshot (`dialogs.snapshot`) remains for offline bootstrap.
- IndexedDB cache is for online fast reloads; it does not replace offline snapshot.
- Both are cleared on logout.

## Potential Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| IndexedDB migration fails (version conflict) | Test migration in development; handle `onupgradeneeded` gracefully. |
| Cache stale while dialogs changed (new chats, renamed) | 5‑minute TTL is acceptable for gallery use case; manual refresh available. |
| Cache not cleared on logout (data leakage) | Ensure `clearDialogCache` is called in `switchToMockAdapter` and `handleSessionExpired`. |
| Mock adapter caching breaks existing tests | Verify short suite passes; ensure cache‑hit path returns same data shape. |
| TypeScript errors due to extra `forceRefresh` property | Keep property optional; adapters ignore unknown properties. |
| Race condition: multiple `getDialogs` calls cause multiple cache writes | Acceptable; last write wins. Could add debounce but not needed. |
| Cache size bloat (unlikely) | Dialog data is small (<100 KB). No automatic eviction needed. |

## Success Criteria

1. App reload (online) shows dialogs instantly (<1 s) instead of waiting for Telegram API.
2. Cache respects 5‑minute TTL; stale data triggers fresh fetch.
3. Manual refresh (future UI) bypasses cache.
4. No regression in offline snapshot behavior.
5. All existing tests pass.
6. TypeScript strict mode satisfied.

## Files to Modify

1. `src/lib/cache/indexeddb.ts` – DB version, new store, cache functions.
2. `src/lib/telegram/mtcute.ts` – cache‑first logic in `getDialogs`.
3. `src/lib/telegram/mock.ts` – cache‑first logic in `getDialogs`.
4. `src/stores/telegram.ts` – clear cache on logout/session expiry.
5. `src/components/dialogs/DialogList.svelte` – separate `loadDialogs` and `refreshDialogs`.

**No changes required in:**
- `src/App.svelte` (caching is inside adapter)
- `src/stores/dialogs.ts` (snapshot system unchanged)
- `APPLICATION_SPEC.md` (caching is internal optimization, not a user‑visible feature)
- `STATUS.md` (will be updated after implementation)

## Estimated Effort

**Medium** – requires careful IndexedDB migration and adapter modifications, but follows existing patterns.

## Blockers

None identified; all dependencies are in place.

## Notes

- Follow existing code patterns (debug logging, error handling).
- Ensure all object URLs are properly revoked (not applicable here).
- Update `STATUS.md` after each logical block (Phase 1‑5).
- Commit after each phase with conventional commit message (`feat: add dialog metadata cache`, `refactor: implement cache‑first logic in mtcute adapter`, etc.).