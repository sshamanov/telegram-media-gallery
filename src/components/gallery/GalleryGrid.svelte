<script lang="ts">
  import { onMount } from 'svelte'
  import { galleryFilters, matchesFilter, mediaTypeToFilter } from '../../lib/media'
  import MediaItemCard from './MediaItem.svelte'
  import MediaListRow from './MediaListRow.svelte'
  import DialogPicker from './DialogPicker.svelte'
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
    forwardQueueState,
    enqueueForwards,
    cancelForwards,
    shareQueueState,
    enqueueShares,
    cancelShares,
    copyQueueState,
    enqueueCopies,
    cancelCopies,
    uploadQueueState,
    cancelUploadQueue,
    cancelUploadQueueItem,
    retryUploadQueueItem,
  } from '../../stores/gallery'
  import { galleryIds, toggleGallery } from '../../stores/dialogs'
  import { settings, updateSettings } from '../../stores/settings'
  import { pushToast } from '../../stores/ui'
  import type { GalleryFilterId, MediaItem, UploadMode as UploadModeType } from '../../types/telegram'

  let activeFilter: GalleryFilterId = 'all'
  let showUploadSheet = false
  let fileInput: HTMLInputElement | null = null
  let pendingUploadMode: UploadModeType = 'media'
  let scroller: HTMLElement | null = null
  let showDialogPicker = false

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

  function cycleGridColumns(): void {
    const current = $settings.gridColumns
    const next = current >= 5 ? 2 : current + 1
    updateSettings({ gridColumns: next })
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
    let directoryHandle: FileSystemDirectoryHandle | null = null

    // Try to use File System Access API on desktop
    if ('showDirectoryPicker' in window && window.showDirectoryPicker) {
      try {
        directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads',
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('Failed to request directory, falling back to per-file downloads:', error)
        }
      }
    }

    await enqueueDownloads(selectedItems, directoryHandle)
  }

  function handleForward(): void {
    if (selectedCount === 0) {
      return
    }

    showDialogPicker = true
  }

  async function handleForwardToDialog(dialogId: string, _dialogTitle: string): Promise<void> {
    if (selectedCount === 0) {
      return
    }

    const selectedItems = visibleItems.filter((item) => $selectedMediaIds.has(item.id))
    await enqueueForwards(selectedItems, dialogId)
  }

  async function handleShare(): Promise<void> {
    if (selectedCount === 0) {
      return
    }

    const selectedItems = visibleItems.filter((item) => $selectedMediaIds.has(item.id))
    await enqueueShares(selectedItems)
  }

  async function handleCopy(): Promise<void> {
    if (selectedCount === 0) {
      return
    }

    const selectedItems = visibleItems.filter((item) => $selectedMediaIds.has(item.id))
    await enqueueCopies(selectedItems)
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
      role="application"
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
          <button
            class="button secondary"
            type="button"
            on:click={() => handleForward()}
            disabled={selectedCount === 0}
            data-testid="gallery-selection-forward"
          >
            Forward
          </button>
           <button
            class="button secondary"
            type="button"
            on:click={() => handleShare()}
            disabled={selectedCount === 0 || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function'}
            data-testid="gallery-selection-share"
          >
            Share
          </button>
          <button
            class="button secondary"
            type="button"
            on:click={() => handleCopy()}
            disabled={selectedCount === 0 || typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined'}
            data-testid="gallery-selection-copy"
          >
            Copy
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

        {#if $forwardQueueState.active}
          <div class="panel download-panel" data-testid="gallery-forward-panel">
            <div class="download-progress">
              <div class="download-status">
                Forwarding {$forwardQueueState.currentIndex + 1} of {$forwardQueueState.totalItems} items
                {#if $forwardQueueState.currentIndex >= 0 && $forwardQueueState.items[$forwardQueueState.currentIndex]}
                  - {$forwardQueueState.items[$forwardQueueState.currentIndex].fileName}
                {/if}
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style="width: {$forwardQueueState.currentIndex >= 0 && $forwardQueueState.items[$forwardQueueState.currentIndex]
                    ? $forwardQueueState.items[$forwardQueueState.currentIndex].progress + '%'
                    : '0%'}"
                ></div>
              </div>
              <div class="download-actions">
                <button
                  class="button ghost small"
                  type="button"
                  on:click={cancelForwards}
                  data-testid="gallery-forward-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
         {/if}

         {#if $shareQueueState.active}
           <div class="panel download-panel" data-testid="gallery-share-panel">
             <div class="download-progress">
               <div class="download-status">
                 Sharing {$shareQueueState.currentIndex + 1} of {$shareQueueState.totalItems} items
                 {#if $shareQueueState.currentIndex >= 0 && $shareQueueState.items[$shareQueueState.currentIndex]}
                   - {$shareQueueState.items[$shareQueueState.currentIndex].fileName}
                 {/if}
               </div>
               <div class="progress-bar">
                 <div
                   class="progress-fill"
                   style="width: {$shareQueueState.currentIndex >= 0 && $shareQueueState.items[$shareQueueState.currentIndex]
                     ? $shareQueueState.items[$shareQueueState.currentIndex].progress + '%'
                     : '0%'}"
                 ></div>
               </div>
               <div class="download-actions">
                 <button
                   class="button ghost small"
                   type="button"
                   on:click={cancelShares}
                   data-testid="gallery-share-cancel"
                 >
                   Cancel
                 </button>
               </div>
             </div>
           </div>
          {/if}

          {#if $copyQueueState.active}
            <div class="panel download-panel" data-testid="gallery-copy-panel">
              <div class="download-progress">
                <div class="download-status">
                  Copying {$copyQueueState.currentIndex + 1} of {$copyQueueState.totalItems} items
                  {#if $copyQueueState.currentIndex >= 0 && $copyQueueState.items[$copyQueueState.currentIndex]}
                    - {$copyQueueState.items[$copyQueueState.currentIndex].fileName}
                  {/if}
                </div>
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    style="width: {$copyQueueState.currentIndex >= 0 && $copyQueueState.items[$copyQueueState.currentIndex]
                      ? $copyQueueState.items[$copyQueueState.currentIndex].progress + '%'
                      : '0%'}"
                  ></div>
                </div>
                <div class="download-actions">
                  <button
                    class="button ghost small"
                    type="button"
                    on:click={cancelCopies}
                    data-testid="gallery-copy-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
           {/if}

            {#if $uploadQueueState.active}
              <div class="panel download-panel" data-testid="gallery-upload-panel">
                <div class="download-progress">
                  <div class="download-status">
                    Uploading {$uploadQueueState.currentIndex + 1} of {$uploadQueueState.items.length} items
                    {#if $uploadQueueState.currentIndex >= 0 && $uploadQueueState.items[$uploadQueueState.currentIndex]}
                      - {$uploadQueueState.items[$uploadQueueState.currentIndex].fileName}
                    {/if}
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      style="width: {$uploadQueueState.currentIndex >= 0 && $uploadQueueState.items[$uploadQueueState.currentIndex]
                        ? $uploadQueueState.items[$uploadQueueState.currentIndex].progress + '%'
                        : '0%'}"
                    ></div>
                  </div>
                  <div class="download-actions">
                    <button
                      class="button ghost small"
                      type="button"
                      on:click={cancelUploadQueue}
                      data-testid="gallery-upload-cancel"
                    >
                      Cancel All
                    </button>
                  </div>
                </div>
                
                {#if $uploadQueueState.items.length > 0}
                  <div class="queue-items">
                    {#each $uploadQueueState.items as item (item.id)}
                      <div class="queue-item {item.status}">
                        <div class="queue-item-info">
                          <div class="queue-item-name">{item.fileName}</div>
                          <div class="queue-item-status">
                            {#if item.status === 'queued'}
                              Queued
                            {:else if item.status === 'uploading'}
                              Uploading ({item.progress}%)
                            {:else if item.status === 'complete'}
                              Complete
                            {:else if item.status === 'error'}
                              Error: {item.error}
                            {:else if item.status === 'cancelled'}
                              Cancelled
                            {/if}
                          </div>
                        </div>
                        <div class="queue-item-actions">
                          {#if item.status === 'error'}
                            <button
                              class="button ghost xsmall"
                              type="button"
                              on:click={() => retryUploadQueueItem(item.id)}
                              data-testid="upload-item-retry"
                            >
                              Retry
                            </button>
                          {/if}
                          {#if item.status === 'queued' || item.status === 'uploading'}
                            <button
                              class="button ghost xsmall"
                              type="button"
                              on:click={() => cancelUploadQueueItem(item.id)}
                              data-testid="upload-item-cancel"
                            >
                              Cancel
                            </button>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
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
            on:click={cycleGridColumns}
            aria-label="Grid columns"
            use:tooltip={{ text: 'Cycle grid columns (2–5)' }}
            data-testid="gallery-grid-columns-button"
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

    <DialogPicker
      open={showDialogPicker}
      onClose={() => showDialogPicker = false}
      onForward={handleForwardToDialog}
    />
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

  .button.xsmall {
    padding: 4px 8px;
    font-size: 0.8rem;
  }

  .queue-items {
    margin-top: 12px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }

  .queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    margin-bottom: 6px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .queue-item.queued {
    opacity: 0.8;
  }

  .queue-item.uploading {
    border-color: rgba(0, 136, 204, 0.3);
    background: rgba(0, 136, 204, 0.08);
  }

  .queue-item.complete {
    border-color: rgba(0, 204, 68, 0.3);
    background: rgba(0, 204, 68, 0.08);
  }

  .queue-item.error {
    border-color: rgba(204, 68, 0, 0.3);
    background: rgba(204, 68, 0, 0.08);
  }

  .queue-item.cancelled {
    opacity: 0.6;
    border-color: rgba(136, 136, 136, 0.3);
    background: rgba(136, 136, 136, 0.08);
  }

  .queue-item-info {
    flex: 1;
    min-width: 0;
  }

  .queue-item-name {
    font-size: 0.9rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }

  .queue-item-status {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .queue-item-actions {
    display: flex;
    gap: 8px;
    margin-left: 12px;
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
