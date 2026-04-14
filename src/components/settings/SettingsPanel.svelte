<script lang="ts">
  import { onMount } from 'svelte'
  import { galleryFilters } from '../../lib/media'
  import { settings, updateSettings, applyTheme } from '../../stores/settings'
  import type { AppTheme } from '../../types/telegram'
  import { pushToast } from '../../stores/ui'
   import { clearAllCachedMedia, getThumbCacheInfo } from '../../lib/cache/indexeddb'
  import { clearOpfsMedia, getOpfsStorageInfo, isOpfsAvailable } from '../../lib/cache/opfs'
  import type { GalleryFilterId } from '../../types/telegram'

  import CacheIndicator from '../ui/CacheIndicator.svelte'

  interface StorageInfo {
    thumbs: { itemCount: number; totalBytes: number } | null
    opfs: { itemCount: number; totalBytes: number } | null
    swCache: number | null   // bytes
  }

  let draft = $settings
  let storageInfo: StorageInfo = { thumbs: null, opfs: null, swCache: null }
  let loadingStorage = false

  $: draft = $settings

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  async function loadStorageInfo(): Promise<void> {
    loadingStorage = true
    try {
      const [thumbs, opfs] = await Promise.all([
        getThumbCacheInfo(),
        isOpfsAvailable() ? getOpfsStorageInfo() : Promise.resolve(null),
      ])

      let swCache: number | null = null
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
        swCache = total
      }

      storageInfo = { thumbs, opfs, swCache }
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
    await clearAllCachedMedia()
    pushToast({ kind: 'success', text: 'Thumbnail cache cleared', dismissible: true })
    await loadStorageInfo()
  }

  async function clearFullMedia(): Promise<void> {
    await clearOpfsMedia()
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
      <div class="storage-rows">
        <div class="storage-row">
          <div>
            <div class="storage-label">Thumbnails (IndexedDB)</div>
            <div class="muted storage-meta">
              {storageInfo.thumbs ? `${storageInfo.thumbs.itemCount} items · ${formatBytes(storageInfo.thumbs.totalBytes)}` : '—'}
            </div>
          </div>
          <button class="button danger compact-btn" type="button" on:click={clearThumbs}>Clear</button>
        </div>

        <div class="storage-row">
          <div>
            <div class="storage-label">Full media {isOpfsAvailable() ? '(OPFS)' : '(IndexedDB)'}</div>
            <div class="muted storage-meta">
              {storageInfo.opfs
                ? `${storageInfo.opfs.itemCount} items · ${formatBytes(storageInfo.opfs.totalBytes)}`
                : isOpfsAvailable() ? '—' : 'OPFS not available'}
            </div>
          </div>
          <button class="button danger compact-btn" type="button" on:click={clearFullMedia} disabled={!isOpfsAvailable()}>Clear</button>
        </div>

        <div class="storage-row">
          <div>
            <div class="storage-label">App cache (Service Worker)</div>
            <div class="muted storage-meta">
              {storageInfo.swCache !== null ? formatBytes(storageInfo.swCache) : '—'}
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
