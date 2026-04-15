<script lang="ts">
  import { onMount } from 'svelte'
  import { galleryFilters, matchesFilter, mediaTypeToFilter } from '../../lib/media'
  import MediaItemCard from './MediaItem.svelte'
  import MediaListRow from './MediaListRow.svelte'
  import { tooltip } from '../../lib/dom/tooltips'
  import { navigateToDialogList } from '../../lib/routing'
  import {
    currentDialog,
    galleryViewMode,
    hasMoreMedia,
    isLoadingMore,
    loadMoreMedia,
    loadState,
    mediaItems,
    openViewer,
    setGalleryViewMode,
    totalMessageCount,
    selectionMode,
    selectedMediaIds,
    selectionAnchorId,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectedMedia,
    selectMediaRange,
    selectAllVisibleMedia,
    downloadQueueState,
    enqueueDownloads,
    cancelDownloads,
  } from '../../stores/gallery'
  import { galleryIds, toggleGallery } from '../../stores/dialogs'
  import { settings } from '../../stores/settings'
  import { pushToast } from '../../stores/ui'
  import type { GalleryFilterId, MediaItem, UploadMode as UploadModeType } from '../../types/telegram'

  let activeFilter: GalleryFilterId = 'all'
  let showUploadSheet = false
  let fileInput: HTMLInputElement | null = null
  let pendingUploadMode: UploadModeType = 'media'
  let scroller: HTMLElement | null = null

  $: hiddenFilters = $settings.defaultHiddenFilters ?? []
  $: counts = countFilters($mediaItems)
  $: visibleItems = $mediaItems.filter((item) => isVisible(item, activeFilter, hiddenFilters))
  $: gridTemplate = `repeat(${$settings.gridColumns}, minmax(0, 1fr))`
  $: selectedCount = $selectedMediaIds.size

  $: if ($currentDialog?.id) {
    showUploadSheet = false
  }

  function countFilters(items: MediaItem[]): Record<GalleryFilterId, number> {
    const next: Record<GalleryFilterId, number> = {
      all: items.length,
      photos: 0,
      videos: 0,
      audio: 0,
      docs: 0,
    }

    for (const item of items) {
      next[mediaTypeToFilter(item.type)] += 1
    }

    return next
  }

  function isVisible(item: MediaItem, filterId: GalleryFilterId, hidden: GalleryFilterId[]): boolean {
    if (filterId === 'all') {
      return !hidden.includes(mediaTypeToFilter(item.type))
    }

    return matchesFilter(item, filterId)
  }

  function back(): void {
    navigateToDialogList()
  }

  function openById(itemId: string): void {
    const index = visibleItems.findIndex((item) => item.id === itemId)
    if (index >= 0) {
      openViewer(visibleItems, index)
    }
  }

  function handleItemActivate(itemId: string, event: MouseEvent): void {
    if ($selectionMode) {
      toggleSelectedMedia(itemId)
      return
    }

    if (event.shiftKey) {
      if (!$selectionAnchorId) {
        enterSelectionMode(itemId)
      } else {
        selectMediaRange(visibleItems.map(item => item.id), $selectionAnchorId, itemId)
      }
      return
    }

    if (event.ctrlKey || event.metaKey) {
      enterSelectionMode(itemId)
      return
    }

    openById(itemId)
  }

  function handleItemLongPress(itemId: string): void {
    if (!$selectionMode) {
      enterSelectionMode(itemId)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50)
      }
    }
  }

  function selectFilter(filterId: GalleryFilterId): void {
    activeFilter = filterId
  }

  function toggleViewMode(): void {
    setGalleryViewMode($galleryViewMode === 'grid' ? 'list' : 'grid')
  }

  function toggleUploadSheet(): void {
    showUploadSheet = !showUploadSheet
  }

  function requestUpload(mode: UploadModeType): void {
    pendingUploadMode = mode
    fileInput?.click()
  }

  function handleUpload(event: Event): void {
    const input = event.currentTarget as HTMLInputElement
    const fileCount = input.files?.length ?? 0
    if (fileCount > 0) {
      pushToast({
        kind: 'info',
        text: `Upload is not restored yet. Selected ${fileCount} file(s) as ${pendingUploadMode}.`,
        dismissible: true,
      })
    }
    input.value = ''
    showUploadSheet = false
  }

  async function handleScroll(): Promise<void> {
    if (!scroller || $isLoadingMore || !$hasMoreMedia) {
      return
    }

    const threshold = 300
    const distanceFromBottom = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight)
    if (distanceFromBottom <= threshold) {
      await loadMoreMedia()
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && $selectionMode) {
      exitSelectionMode()
    }
  }

  async function handleBulkDownload(): Promise<void> {
    if (selectedCount === 0) {
      return
    }

    const selectedItems = visibleItems.filter((item) => $selectedMediaIds.has(item.id))
    await enqueueDownloads(selectedItems)
  }

  onMount(() => {
    scroller?.focus()
  })
</script>

{#if $currentDialog}
    <section
      bind:this={scroller}
      class="gallery-shell"
      aria-label="Gallery"
      tabindex="0"
      on:scroll={() => void handleScroll()}
      on:keydown={handleKeyDown}
      data-testid="gallery-root"
    >
    {#if $selectionMode}
      <header class="panel gallery-header selection-header" data-testid="gallery-selection-header">
        <button class="button ghost" type="button" on:click={exitSelectionMode} data-testid="gallery-selection-cancel">Cancel</button>

        <div class="title-block">
          <h2>{selectedCount} selected</h2>
          <div class="muted count-label" data-testid="gallery-selection-count">
            {selectedCount} of {visibleItems.length} visible items selected
          </div>
        </div>

        <div class="actions">
          <button
            class="button secondary"
            type="button"
            on:click={() => selectAllVisibleMedia(visibleItems.map(item => item.id))}
            data-testid="gallery-selection-select-all"
          >
            Select All
          </button>
          <button
            class="button primary"
            type="button"
            on:click={() => handleBulkDownload()}
            disabled={selectedCount === 0 || $downloadQueueState.active}
            data-testid="gallery-selection-download"
          >
            Download
          </button>
         </div>
       </header>

       {#if $downloadQueueState.active}
         <div class="panel download-panel" data-testid="gallery-download-panel">
           <div class="download-progress">
             <div class="download-status">
               Downloading {$downloadQueueState.currentIndex + 1} of {$downloadQueueState.totalItems} items
               {#if $downloadQueueState.currentIndex >= 0 && $downloadQueueState.items[$downloadQueueState.currentIndex]}
                 - {$downloadQueueState.items[$downloadQueueState.currentIndex].fileName}
               {/if}
             </div>
             <div class="progress-bar">
               <div
                 class="progress-fill"
                 style="width: {$downloadQueueState.currentIndex >= 0 && $downloadQueueState.items[$downloadQueueState.currentIndex]
                   ? $downloadQueueState.items[$downloadQueueState.currentIndex].progress + '%'
                   : '0%'}"
               ></div>
             </div>
             <div class="download-actions">
               <button
                 class="button ghost small"
                 type="button"
                 on:click={cancelDownloads}
                 data-testid="gallery-download-cancel"
               >
                 Cancel
               </button>
             </div>
           </div>
         </div>
       {/if}
     {:else}
      <header class="panel gallery-header">
        <button class="button ghost" type="button" on:click={back} data-testid="gallery-back-button">← Back</button>

        <div class="title-block">
          <h2>{$currentDialog.title}</h2>
          <div class="muted count-label">
            {visibleItems.length} visible
            {$mediaItems.length !== visibleItems.length ? ` / ${$mediaItems.length} loaded` : ' media loaded'}
            {$totalMessageCount !== null ? ` (${$totalMessageCount} total messages)` : ''}
          </div>
        </div>

        <div class="actions">
          <button
            class="button secondary"
            type="button"
            on:click={toggleViewMode}
            aria-label="Toggle view mode"
            use:tooltip={{ text: 'Toggle view mode' }}
            data-testid="gallery-view-toggle"
          >
            {$galleryViewMode === 'grid' ? 'List' : 'Grid'}
          </button>

          <button
            class="button secondary"
            type="button"
            aria-label="Grid columns"
            use:tooltip={{ text: 'Grid columns' }}
          >
            {$settings.gridColumns}x
          </button>

          <button
            class={`button ${$galleryIds.includes($currentDialog.id) ? 'danger' : 'secondary'}`}
            type="button"
            on:click={() => toggleGallery($currentDialog.id)}
            aria-label="Toggle gallery bookmark"
            use:tooltip={{ text: $galleryIds.includes($currentDialog.id) ? 'Remove from galleries' : 'Add to galleries' }}
            data-testid="gallery-bookmark-toggle"
          >
            ★
          </button>

          <button
            class="button secondary"
            type="button"
            on:click={toggleUploadSheet}
            aria-label="Upload media"
            use:tooltip={{ text: 'Upload media' }}
            data-testid="gallery-upload-toggle"
          >
            Upload
          </button>
        </div>
      </header>
    {/if}

    {#if showUploadSheet}
      <div class="panel upload-sheet" data-testid="gallery-upload-sheet">
        <button class="button secondary" type="button" on:click={() => requestUpload('media')}>Upload as media</button>
        <button class="button secondary" type="button" on:click={() => requestUpload('file')}>Upload as file</button>
      </div>
    {/if}

    <input bind:this={fileInput} class="sr-only" type="file" multiple on:change={handleUpload} />

    <div class="filter-bar" data-testid="gallery-filter-bar">
      {#each galleryFilters as filter}
        <button
          class:active={activeFilter === filter.id}
          class={`filter-pill ${filter.id !== 'all' && hiddenFilters.includes(filter.id) ? 'hidden-default' : ''}`}
          type="button"
          disabled={filter.id !== 'all' && counts[filter.id] === 0}
          on:click={() => selectFilter(filter.id)}
          data-testid={`gallery-filter-${filter.id}`}
        >
          {filter.label}
        </button>
      {/each}
    </div>

    {#if $galleryViewMode === 'grid'}
      <div class="grid" style:grid-template-columns={gridTemplate} data-testid="gallery-grid">
        {#each visibleItems as item (item.id)}
          <MediaItemCard
            item={item}
            onActivate={handleItemActivate}
            onLongPress={handleItemLongPress}
            selectionMode={$selectionMode}
            selected={$selectedMediaIds.has(item.id)}
          />
        {/each}
      </div>
    {:else}
      <div class="list-view" data-testid="gallery-list">
        {#each visibleItems as item (item.id)}
          <MediaListRow
            item={item}
            onActivate={handleItemActivate}
            onLongPress={handleItemLongPress}
            selectionMode={$selectionMode}
            selected={$selectedMediaIds.has(item.id)}
          />
        {/each}
      </div>
    {/if}

    {#if visibleItems.length === 0 && $mediaItems.length > 0}
      <div class="empty-state muted" data-testid="gallery-empty-filtered">No items match the current filter.</div>
    {/if}

    {#if !$mediaItems.length && $loadState === 'idle'}
      <div class="empty-state muted" data-testid="gallery-empty">No media loaded for this dialog.</div>
    {/if}

    {#if $loadState === 'loading' || $isLoadingMore}
      <div class="loading muted" data-testid="gallery-loading">Loading media...</div>
    {/if}

    {#if !$isLoadingMore && !$hasMoreMedia && visibleItems.length > 0}
      <div class="loading muted" data-testid="gallery-complete">All media loaded</div>
    {/if}

    <div class="pull-refresh-note muted">Pull-to-refresh is temporarily disabled during gallery recovery.</div>
  </section>
{/if}

<style>
  .gallery-shell {
    display: grid;
    gap: 16px;
    max-height: calc(100vh - 72px);
    max-height: calc(100dvh - 72px);
    overflow: auto;
    outline: none;
  }

  .gallery-header {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    background: rgba(42, 42, 42, 0.94);
    backdrop-filter: blur(20px);
  }

  h2 {
    margin: 0;
  }

  .title-block {
    flex: 1;
    min-width: 0;
  }

  .count-label {
    margin-top: 4px;
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .upload-sheet {
    display: flex;
    gap: 10px;
    padding: 12px;
  }

  .download-panel {
    padding: 12px;
  }

  .download-progress {
    display: grid;
    gap: 8px;
  }

  .download-status {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .progress-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.3s ease;
  }

  .download-actions {
    display: flex;
    justify-content: flex-end;
  }

  .button.small {
    padding: 6px 12px;
    font-size: 0.85rem;
  }

  .filter-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 10px 14px;
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
  }

  .filter-pill.active {
    color: var(--text-primary);
    background: rgba(0, 136, 204, 0.24);
    border-color: rgba(0, 136, 204, 0.45);
  }

  .filter-pill.hidden-default::after {
    content: ' hidden';
    font-size: 0.72rem;
  }

  .filter-pill:disabled,
  .button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }

  .grid {
    display: grid;
    gap: 6px;
  }

  .list-view {
    display: grid;
    gap: 10px;
  }

  .empty-state,
  .loading,
  .pull-refresh-note {
    padding: 12px 0 18px;
    text-align: center;
  }

  @media (max-width: 720px) {
    .gallery-shell {
      gap: 12px;
      max-height: calc(100dvh - 48px);
    }

    .gallery-header {
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px;
    }

    .actions {
      width: 100%;
      justify-content: flex-start;
    }

    .upload-sheet {
      flex-direction: column;
    }
  }
</style>
