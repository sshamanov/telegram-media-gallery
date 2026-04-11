<script lang="ts">
  import { galleryFilters } from '../../lib/media'
  import { settings, updateSettings } from '../../stores/settings'
  import { pushToast } from '../../stores/ui'
  import { clearAllCachedMedia } from '../../lib/cache/indexeddb'
  import type { GalleryFilterId } from '../../types/telegram'

  let draft = $settings

  $: draft = $settings

  async function save(): Promise<void> {
    updateSettings(draft)
    pushToast({ kind: 'success', text: 'Settings saved', dismissible: true })
  }

  async function clearCache(): Promise<void> {
    await clearAllCachedMedia()
    pushToast({ kind: 'success', text: 'Cache cleared', dismissible: true })
  }

  function toggleDefaultHiddenFilter(filterId: GalleryFilterId): void {
    const next = draft.defaultHiddenFilters.includes(filterId)
      ? draft.defaultHiddenFilters.filter((value) => value !== filterId)
      : [...draft.defaultHiddenFilters, filterId]

    draft = { ...draft, defaultHiddenFilters: next }
  }
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

  <div class="actions">
    <button class="button" type="button" on:click={save}>Save Settings</button>
    <button class="button danger" type="button" on:click={clearCache}>Clear All Cache</button>
  </div>
</section>

<style>
  .settings-grid {
    display: grid;
    gap: 14px;
  }

  label {
    display: grid;
    gap: 8px;
  }

  .filter-defaults {
    display: grid;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  legend,
  span {
    color: var(--text-secondary);
  }

  .filter-options {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .checkbox-row {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
</style>
