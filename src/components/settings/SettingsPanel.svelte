<script lang="ts">
  import { onMount } from 'svelte'
  import { galleryFilters } from '../../lib/media'
  import {
    fullMediaStorage,
    refreshFullMediaStorageState,
    settings,
    updateSettings,
    applyTheme,
  } from '../../stores/settings'
  import type { AppTheme } from '../../types/telegram'
  import { pushToast } from '../../stores/ui'
  import {
    clearFullMediaCache,
    clearThumbnailCache,
  } from '../../lib/cache/indexeddb'
  import { clearOpfsMedia } from '../../lib/cache/opfs'
  import { formatBytes, getStorageUsage, type StorageUsage } from '../../lib/cache/storage-usage'
  import type { GalleryFilterId } from '../../types/telegram'

  import CacheIndicator from '../ui/CacheIndicator.svelte'

  let draft = $settings
  let storageInfo: StorageUsage | null = null
  let swCache = 0
  let loadingStorage = false

  $: draft = $settings

  function describeMigrationStatus(): string {
    switch ($fullMediaStorage.migrationStatus) {
      case 'running':
        return `Migrating ${$fullMediaStorage.processedEntries} of ${$fullMediaStorage.totalEntries} cached items into OPFS.`
      case 'completed':
        return $fullMediaStorage.detail ?? 'OPFS is active for new full-media downloads.'
      case 'partial':
        return $fullMediaStorage.detail ?? 'Some full-media items still remain in IndexedDB and will retry on next launch.'
      case 'fallback':
      case 'unsupported':
        return $fullMediaStorage.detail ?? 'IndexedDB fallback is active because OPFS is unavailable.'
      default:
        return 'Checking full-media storage backend.'
    }
  }

  async function loadStorageInfo(): Promise<void> {
    loadingStorage = true
    try {
      const [usage] = await Promise.all([
        getStorageUsage(),
        refreshFullMediaStorageState(),
      ])

      let nextSwCache = 0
      if ('caches' in window) {
        let total = 0
        const keys = await caches.keys()
        for (const key of keys) {
          const cache = await caches.open(key)
          const requests = await cache.keys()
          for (const req of requests) {
            const res = await cache.match(req)
            if (res) {
              const blob = await res.blob()
              total += blob.size
            }
          }
        }
        nextSwCache = total
      }

      storageInfo = usage
      swCache = nextSwCache
    } finally {
      loadingStorage = false
    }
  }

  const themes: Array<{ value: AppTheme; label: string }> = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ]

  async function save(): Promise<void> {
    updateSettings(draft)
    applyTheme(draft.theme)
    pushToast({ kind: 'success', text: 'Settings saved', dismissible: true })
  }

  async function clearThumbs(): Promise<void> {
    await clearThumbnailCache()
    pushToast({ kind: 'success', text: 'Thumbnail cache cleared', dismissible: true })
    await loadStorageInfo()
  }

  async function clearFullMedia(): Promise<void> {
    await Promise.all([
      clearFullMediaCache(),
      clearOpfsMedia(),
    ])
    pushToast({ kind: 'success', text: 'Full media cache cleared', dismissible: true })
    await loadStorageInfo()
  }

  async function clearSwCache(): Promise<void> {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    pushToast({ kind: 'warning', text: 'App cache cleared — offline mode unavailable until next online visit', dismissible: true })
    await loadStorageInfo()
  }

  function toggleDefaultHiddenFilter(filterId: GalleryFilterId): void {
    const next = draft.defaultHiddenFilters.includes(filterId)
      ? draft.defaultHiddenFilters.filter((value) => value !== filterId)
      : [...draft.defaultHiddenFilters, filterId]
    draft = { ...draft, defaultHiddenFilters: next }
  }

  onMount(() => {
    void loadStorageInfo()
  })
</script>

<section class="settings-grid">
  <label>
    <span>Thumbnails cache limit</span>
    <input class="field" bind:value={draft.thumbCacheLimit} type="number" min="100" step="100" />
  </label>
  <label>
    <span>Full media cache limit</span>
    <input class="field" bind:value={draft.fullCacheLimit} type="number" min="50" step="50" />
  </label>
  <label>
    <span>Maximum cache size (MB)</span>
    <input class="field" bind:value={draft.maxCacheSizeMb} type="number" min="100" step="50" />
  </label>
  <label>
    <span>Default grid columns</span>
    <input class="field" bind:value={draft.gridColumns} type="number" min="1" max="8" />
  </label>

   <fieldset class="theme-section">
     <legend>Theme</legend>
     <div class="theme-options">
       {#each themes as t}
         <label class="checkbox-row">
           <input type="radio" name="theme" value={t.value} bind:group={draft.theme} />
           <span>{t.label}</span>
         </label>
       {/each}
     </div>
   </fieldset>

   <fieldset class="theme-section">
     <legend>Gallery Layout</legend>
     <div class="theme-options">
       <label class="checkbox-row">
         <input type="radio" name="layoutMode" value="grid" bind:group={draft.layoutMode} />
         <span>Grid layout</span>
       </label>
       <label class="checkbox-row">
         <input type="radio" name="layoutMode" value="masonry" bind:group={draft.layoutMode} />
         <span>Masonry layout</span>
       </label>
     </div>
     <label class="checkbox-row" style="margin-top: 12px;">
       <input type="checkbox" bind:checked={draft.autoDetectMasonry} />
       <span>Auto-detect masonry for visual content</span>
     </label>
   </fieldset>

  <fieldset class="filter-defaults">
    <legend>Default hidden types</legend>
    <div class="filter-options">
      {#each galleryFilters.filter((filter) => filter.id !== 'all') as filter}
        <label class="checkbox-row">
          <input
            type="checkbox"
            checked={draft.defaultHiddenFilters.includes(filter.id)}
            on:change={() => toggleDefaultHiddenFilter(filter.id)}
          />
          <span>{filter.label}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <!-- Storage breakdown -->
  <fieldset class="storage-section">
    <legend>Storage</legend>
    {#if loadingStorage}
      <div class="muted storage-loading">Loading storage info...</div>
    {:else}
      <div class="storage-status panel-subtle">
        <div class="storage-status-label">Active full-media backend</div>
        <div class="storage-status-value" data-testid="full-media-backend-status">
          {$fullMediaStorage.activeBackend === 'opfs' ? 'OPFS' : 'IndexedDB fallback'}
        </div>
        <div class="muted storage-status-detail" data-testid="full-media-migration-status">
          {describeMigrationStatus()}
        </div>
        <div class="muted storage-status-detail" data-testid="offline-actions-status">
          Offline actions: downloads stay disabled, forwarding stays disabled, and sharing stays disabled until connectivity returns.
        </div>
      </div>

      <div class="storage-rows">
        <div class="storage-row">
          <div>
            <div class="storage-label">Thumbnails (IndexedDB)</div>
            <div class="muted storage-meta">
              {storageInfo ? `${storageInfo.thumbnailsCount} items · ${formatBytes(storageInfo.thumbnailsBytes)}` : '—'}
            </div>
          </div>
          <button class="button danger compact-btn" type="button" on:click={clearThumbs}>Clear</button>
        </div>

        <div class="storage-row" data-testid="full-media-primary-row">
          <div>
            <div class="storage-label">
              Full media ({$fullMediaStorage.activeBackend === 'opfs' ? 'OPFS' : 'IndexedDB'})
            </div>
            <div class="muted storage-meta">
              {#if storageInfo}
                {$fullMediaStorage.activeBackend === 'opfs'
                  ? `${storageInfo.opfsCount} items · ${formatBytes(storageInfo.opfsBytes)}`
                  : `${storageInfo.indexedDbFullMediaCount} items · ${formatBytes(storageInfo.indexedDbFullMediaBytes)}`}
              {:else}
                —
              {/if}
            </div>
          </div>
          <button class="button danger compact-btn" type="button" on:click={clearFullMedia}>Clear</button>
        </div>

        {#if storageInfo && $fullMediaStorage.activeBackend === 'opfs'}
          <div class="storage-row" data-testid="full-media-legacy-row">
            <div>
              <div class="storage-label">Legacy full media (IndexedDB)</div>
              <div class="muted storage-meta">
                {storageInfo.indexedDbFullMediaCount} items · {formatBytes(storageInfo.indexedDbFullMediaBytes)}
              </div>
            </div>
            <button class="button danger compact-btn" type="button" on:click={clearFullMedia}>Clear</button>
          </div>
        {/if}

        <div class="storage-row">
          <div>
            <div class="storage-label">App cache (Service Worker)</div>
            <div class="muted storage-meta">
              {formatBytes(swCache)}
            </div>
          </div>
          <button class="button danger compact-btn" type="button" on:click={clearSwCache}>Clear</button>
        </div>
      </div>
     {/if}
  </fieldset>

  <!-- Cache indicator -->
  <div class="cache-indicator-section">
    <CacheIndicator />
  </div>



  <div class="actions">
    <button class="button" type="button" on:click={save}>Save Settings</button>
    <button class="button secondary" type="button" on:click={loadStorageInfo}>Refresh storage info</button>
  </div>
</section>

<style>
  .settings-grid {
    display: grid;
    gap: 18px;
  }

  label {
    display: grid;
    gap: 10px;
    line-height: 1.5;
  }

  .field {
    padding: 12px 14px;
    min-height: 44px;
  }

  .filter-defaults,
  .storage-section,
  .theme-section {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 2px solid var(--border-focus);
    border-radius: 16px;
    background: var(--bg-elevated);
  }

  legend,
  span {
    color: var(--text-secondary);
  }

  .filter-options,
  .theme-options {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .checkbox-row {
    display: inline-flex;
    gap: 10px;
    align-items: center;
    min-height: 24px;
    line-height: 1.4;
  }

  .storage-rows {
    display: grid;
    gap: 14px;
  }

  .storage-status {
    display: grid;
    gap: 4px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
  }

  .storage-status-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .storage-status-value {
    font-size: 1rem;
    font-weight: 700;
  }

  .storage-status-detail {
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .storage-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    min-height: 44px;
  }

  .storage-label {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .storage-meta {
    font-size: 0.82rem;
    margin-top: 2px;
  }

  .storage-loading {
    font-size: 0.9rem;
    padding: 8px 0;
  }

  .compact-btn {
    padding: 8px 14px;
    white-space: nowrap;
    flex-shrink: 0;
  }



   .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  
  .cache-indicator-section {
    padding: 16px;
    border: 2px solid var(--border-focus);
    border-radius: 16px;
    background: var(--bg-elevated);
  }
</style>
