<script lang="ts">
   import { onMount, onDestroy } from 'svelte'
   import { galleryFilters, mediaTypeToFilter } from '../../lib/media'
   import { settings, updateSettings } from '../../stores/settings'
   import type { GalleryLayoutMode } from '../../types/telegram'
 import MediaItemCard from './MediaItem.svelte'
 import MediaListRow from './MediaListRow.svelte'
 import AuthorFilter from './AuthorFilter.svelte'
   import DialogPicker from './DialogPicker.svelte'
    import { tooltip } from '../../lib/dom/tooltips'
    import { navigateToDialogList } from '../../lib/routing'
     import { effectiveDesktopLayout } from '../../lib/dom/desktop-detection'
    import DesktopSidebar from '../layout/DesktopSidebar.svelte'
    import { trapFocus } from '../../lib/dom/focus-trap'
    import {
      analyzeMediaForMasonry,
      getMasonryLayoutClass,
      shouldUseMasonryLayout,
      getNextLayoutMode,
      getLayoutModeTooltip
    } from './utils/masonry'
    import {
      handleGalleryKeyDown as handleGalleryKeyDownUtil,
      scrollFocusedItemIntoView
    } from './utils/keyboard-navigation'

    import {
      refreshOfflineSelectionState as refreshOfflineSelectionStateUtil,
      handleBulkDownload as handleBulkDownloadUtil,
      handleBulkForward as handleBulkForwardUtil,
      handleBulkShare as handleBulkShareUtil,
      handleBulkCopy as handleBulkCopyUtil
    } from './utils/bulk-actions'
    import {
      canDownloadMediaSelectionOffline,
      currentDialog,
      galleryViewMode,
      hasMoreMedia,
      isLoadingMore,
      loadInitialMedia,
      loadMoreMedia,
      loadState,
      mediaItems,
      selectedFilter,
      filteredMediaItems,
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
      storeScrollPosition,
      scrollPositions,
    } from '../../stores/gallery'
   import { galleryIds, toggleGallery } from '../../stores/dialogs'
   import { isOffline, pushToast } from '../../stores/ui'
   import type { GalleryFilterId, MediaItem, UploadMode as UploadModeType } from '../../types/telegram'


   let showUploadSheet = false
   let fileInput: HTMLInputElement | null = null
   let pendingUploadMode: UploadModeType = 'media'
   let scroller: HTMLElement | null = null
   let showDialogPicker = false
   let offlineDownloadReady = false
   let focusedItemIndex: number | null = null
   let selectedMediaItem: MediaItem | null = null
   let restoredScrollDialogId: string | null = null
   
   // Focus trap for progress panels
   let downloadPanelElement: HTMLDivElement | null = null
   let forwardPanelElement: HTMLDivElement | null = null
   let sharePanelElement: HTMLDivElement | null = null
   let copyPanelElement: HTMLDivElement | null = null
   let uploadPanelElement: HTMLDivElement | null = null
   let cleanupFocusTraps: Array<() => void> = []

   // Pull-to-refresh state
   let pullStartY: number | null = null
   let pullCurrentY: number | null = null
   let isPulling = false
   let isRefreshing = false
   
   // Manage focus traps for active progress panels
   $: if ($downloadQueueState.active && downloadPanelElement) {
     cleanupFocusTraps.forEach(fn => fn())
     cleanupFocusTraps = []
     
     const cleanup = trapFocus(downloadPanelElement, {
       onEscape: cancelDownloads,
       hideOtherContent: false
     })
     cleanupFocusTraps.push(cleanup)
   }
   
   $: if ($forwardQueueState.active && forwardPanelElement) {
     cleanupFocusTraps.forEach(fn => fn())
     cleanupFocusTraps = []
     
     const cleanup = trapFocus(forwardPanelElement, {
       onEscape: cancelForwards,
       hideOtherContent: false
     })
     cleanupFocusTraps.push(cleanup)
   }
   
   $: if ($shareQueueState.active && sharePanelElement) {
     cleanupFocusTraps.forEach(fn => fn())
     cleanupFocusTraps = []
     
     const cleanup = trapFocus(sharePanelElement, {
       onEscape: cancelShares,
       hideOtherContent: false
     })
     cleanupFocusTraps.push(cleanup)
   }
   
   $: if ($copyQueueState.active && copyPanelElement) {
     cleanupFocusTraps.forEach(fn => fn())
     cleanupFocusTraps = []
     
     const cleanup = trapFocus(copyPanelElement, {
       onEscape: cancelCopies,
       hideOtherContent: false
     })
     cleanupFocusTraps.push(cleanup)
   }
   
   $: if ($uploadQueueState.active && uploadPanelElement) {
     cleanupFocusTraps.forEach(fn => fn())
     cleanupFocusTraps = []
     
     const cleanup = trapFocus(uploadPanelElement, {
       onEscape: cancelUploadQueue,
       hideOtherContent: false
     })
     cleanupFocusTraps.push(cleanup)
   }
   
   // Clean up focus traps when panels become inactive
   $: if (!$downloadQueueState.active && !$forwardQueueState.active && 
          !$shareQueueState.active && !$copyQueueState.active && 
          !$uploadQueueState.active) {
     cleanupFocusTraps.forEach(fn => fn())
     cleanupFocusTraps = []
   }
   
   onDestroy(() => {
     cleanupFocusTraps.forEach(fn => fn())
     cleanupFocusTraps = []
   })

   $: hiddenFilters = $settings.defaultHiddenFilters ?? []
  $: counts = countFilters($mediaItems)
  $: visibleItems = $filteredMediaItems
  $: selectedItems = visibleItems.filter((item) => $selectedMediaIds.has(item.id))
    $: effectiveColumns = $settings.gridColumns
   $: gridTemplate = `repeat(${effectiveColumns}, minmax(0, 1fr))`
    $: layoutMode = $settings.layoutMode
    $: shouldUseMasonry = shouldUseMasonryLayout(layoutMode, $galleryViewMode)
    $: gridClass = getMasonryLayoutClass(shouldUseMasonry)
   $: desktopLayoutClass = $effectiveDesktopLayout ? `desktop-${$effectiveDesktopLayout}` : ''
  
  // Auto-detection for masonry layout
   $: shouldSuggestMasonry = $settings.autoDetectMasonry && analyzeMediaForMasonry(visibleItems)
   $: showMasonrySuggestion = shouldSuggestMasonry && layoutMode === 'grid' && $galleryViewMode === 'grid'
   
   // Show toast when masonry is suggested
   $: if (showMasonrySuggestion && !hasShownMasonrySuggestion) {
     pushToast({
       kind: 'info',
       text: 'Masonry layout suggested for visual content. Click the Masonry button to switch.',
       dismissible: true,
     })
     hasShownMasonrySuggestion = true
   }
   
   // Reset suggestion flag when conditions change
   $: if (!showMasonrySuggestion) {
     hasShownMasonrySuggestion = false
   }
   
   let hasShownMasonrySuggestion = false
  

  $: selectedCount = $selectedMediaIds.size
  $: galleryStatusText = $isOffline
    ? 'Offline - cached thumbnails remain visible, cached full media still opens, and uncached items fall back to placeholders.'
    : null
  $: void refreshOfflineSelectionState(selectedItems, $isOffline)

  // Pull-to-refresh calculations
  $: pullDistance = pullStartY !== null && pullCurrentY !== null ? Math.max(0, pullCurrentY - pullStartY) : 0
  $: pullProgress = Math.min(pullDistance / 80, 1) // 80px threshold
  $: showPullIndicator = isPulling && pullDistance > 10

   $: if ($currentDialog?.id) {
     showUploadSheet = false
   }

   $: if ($currentDialog?.id !== restoredScrollDialogId) {
     restoredScrollDialogId = null
   }

  $: {
    // Reset focus when items change
    focusedItemIndex = null
  }

   $: if (!$selectionMode) {
    // Reset focus when exiting selection mode
    focusedItemIndex = null
  }

  // Restore once per dialog so viewer open/close does not reset scrolling.
  $: if ($currentDialog?.id && scroller && restoredScrollDialogId !== $currentDialog.id) {
    const dialogId = $currentDialog.id
    const saved = $scrollPositions[dialogId] ?? 0
    restoredScrollDialogId = dialogId

    queueMicrotask(() => {
      if (scroller && $currentDialog?.id === dialogId) {
        scroller.scrollTop = saved
      }
    })
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



  function back(): void {
    navigateToDialogList()
  }

   function openById(itemId: string): void {
     const index = visibleItems.findIndex((item) => item.id === itemId)
     if (index >= 0) {
       const item = visibleItems[index]
       selectedMediaItem = item
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
    selectedFilter.set(filterId)
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

  let scrollSaveTimeout: ReturnType<typeof setTimeout> | null = null

  async function handleScroll(): Promise<void> {
    if (!scroller) {
      return
    }

    // Throttle scroll position saving
    if (scrollSaveTimeout !== null) {
      clearTimeout(scrollSaveTimeout)
    }
    scrollSaveTimeout = setTimeout(() => {
      if ($currentDialog?.id && scroller) {
        storeScrollPosition($currentDialog.id, scroller.scrollTop)
      }
      scrollSaveTimeout = null
    }, 100)

    // Load more media when near bottom
    if (!$isLoadingMore && $hasMoreMedia) {
      const threshold = 300
      const distanceFromBottom = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight)
      if (distanceFromBottom <= threshold) {
        await loadMoreMedia()
      }
    }
  }

   function handleKeyDown(event: KeyboardEvent): void {
    const result = handleGalleryKeyDownUtil(event, {
      mediaItems: visibleItems,
      focusedIndex: focusedItemIndex,
      isSelectionMode: $selectionMode,
      galleryViewMode: $galleryViewMode,
      effectiveColumns: effectiveColumns,
      onOpenItem: openById,
      onToggleSelection: toggleSelectedMedia,
      onExitSelectionMode: exitSelectionMode
    })

    if (result.handled) {
      if (result.newFocusedIndex !== undefined) {
        focusedItemIndex = result.newFocusedIndex
        if (focusedItemIndex !== null && visibleItems[focusedItemIndex]) {
          scrollFocusedItemIntoView(visibleItems[focusedItemIndex].id)
        }
      }
    }
  }

  async function refreshOfflineSelectionState(items: MediaItem[], offline: boolean): Promise<void> {
    offlineDownloadReady = await refreshOfflineSelectionStateUtil(
      items,
      offline,
      canDownloadMediaSelectionOffline
    )
  }

  async function handleBulkDownload(): Promise<void> {
    await handleBulkDownloadUtil({
      selectedCount,
      selectedItems,
      isOffline: $isOffline,
      pushToast,
      enqueueDownloads
    })
  }

  function handleForward(): void {
    handleBulkForwardUtil({
      selectedCount,
      isOffline: $isOffline,
      pushToast,
      onShowDialogPicker: () => { showDialogPicker = true }
    })
  }

  async function handleForwardToDialog(dialogId: string, _dialogTitle: string): Promise<void> {
    if (selectedCount === 0) {
      return
    }

    await enqueueForwards(selectedItems, dialogId)
  }

  async function handleShare(): Promise<void> {
    await handleBulkShareUtil({
      selectedCount,
      selectedItems,
      isOffline: $isOffline,
      pushToast,
      enqueueShares
    })
  }

  async function handleCopy(): Promise<void> {
    await handleBulkCopyUtil({
      selectedCount,
      visibleItems,
      selectedMediaIds: $selectedMediaIds,
      enqueueCopies
    })
  }

   function handleTouchStart(event: TouchEvent): void {
    if (scroller?.scrollTop !== 0 || isRefreshing) {
      return
    }

    pullStartY = event.touches[0].clientY
    pullCurrentY = pullStartY
    isPulling = true
  }

  function handleTouchMove(event: TouchEvent): void {
    if (!isPulling || pullStartY === null) {
      return
    }

    pullCurrentY = event.touches[0].clientY
    const pullDistance = Math.max(0, pullCurrentY - pullStartY)

    // Limit pull distance to 150px
    if (pullDistance > 150) {
      event.preventDefault()
    }
  }

  function handleTouchEnd(): void {
    if (!isPulling || pullStartY === null || pullCurrentY === null) {
      resetPullState()
      return
    }

    const pullDistance = pullCurrentY - pullStartY
    const pullThreshold = 80

    if (pullDistance >= pullThreshold) {
      triggerRefresh()
    } else {
      resetPullState()
    }
  }

  async function triggerRefresh(): Promise<void> {
    isRefreshing = true
    isPulling = false

    try {
      await loadInitialMedia()
    } finally {
      setTimeout(() => {
        isRefreshing = false
        pullStartY = null
        pullCurrentY = null
      }, 300)
    }
  }

  function resetPullState(): void {
    isPulling = false
    pullStartY = null
    pullCurrentY = null
  }

  onMount(() => {
    scroller?.focus()

    // Add touch event listeners
    if (scroller) {
      scroller.addEventListener('touchstart', handleTouchStart, { passive: true })
      scroller.addEventListener('touchmove', handleTouchMove, { passive: false })
      scroller.addEventListener('touchend', handleTouchEnd)
      scroller.addEventListener('touchcancel', resetPullState)
    }
  })

  onDestroy(() => {
    // Clean up event listeners
    if (scroller) {
      scroller.removeEventListener('touchstart', handleTouchStart)
      scroller.removeEventListener('touchmove', handleTouchMove)
      scroller.removeEventListener('touchend', handleTouchEnd)
      scroller.removeEventListener('touchcancel', resetPullState)
    }
    // Clean up scroll save timeout
    if (scrollSaveTimeout !== null) {
      clearTimeout(scrollSaveTimeout)
    }
  })
</script>

  {#if $currentDialog}
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
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
      {#if showPullIndicator || isRefreshing}
        <div class="pull-refresh-indicator" style:transform={isRefreshing ? 'none' : `translateY(${Math.min(pullDistance, 80)}px)`}>
          {#if isRefreshing}
            <div class="refresh-spinner">↻</div>
            <div class="refresh-text">Refreshing...</div>
          {:else}
            <div class="pull-arrow" style:transform={`rotate(${pullProgress * 180}deg)`}>↓</div>
            <div class="pull-text">
              {#if pullProgress >= 1}
                Release to refresh
              {:else}
                Pull to refresh
              {/if}
            </div>
          {/if}
        </div>
      {/if}
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
            disabled={selectedCount === 0 || $downloadQueueState.active || $isOffline}
            data-testid="gallery-selection-download"
            title={$isOffline ? 'Downloads are unavailable offline unless the file is already open in the viewer cache.' : undefined}
          >
            Download
          </button>
          <button
            class="button secondary"
            type="button"
            on:click={() => handleForward()}
            disabled={selectedCount === 0 || $isOffline}
            data-testid="gallery-selection-forward"
            title={$isOffline ? 'Forwarding is unavailable offline until Telegram connectivity returns.' : undefined}
          >
            Forward
          </button>
           <button
            class="button secondary"
            type="button"
            on:click={() => handleShare()}
            disabled={selectedCount === 0 || $isOffline || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function'}
            data-testid="gallery-selection-share"
            title={$isOffline ? 'Sharing is unavailable offline because uncached media cannot be fetched.' : undefined}
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

        {#if $isOffline}
          <p class="gallery-offline-actions muted" data-testid="gallery-offline-actions-status">
            Download, forward, and share stay disabled offline. {offlineDownloadReady
              ? 'The selected items are cached for viewer playback, but export and relay actions still require connectivity.'
              : 'Some selected items are not fully cached for export.'}
          </p>
        {/if}

         {#if $downloadQueueState.active}
           <div class="panel download-panel" data-testid="gallery-download-panel" bind:this={downloadPanelElement}>
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
           <div class="panel download-panel" data-testid="gallery-forward-panel" bind:this={forwardPanelElement}>
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
             <div class="panel download-panel" data-testid="gallery-share-panel" bind:this={sharePanelElement}>
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
             <div class="panel download-panel" data-testid="gallery-copy-panel" bind:this={copyPanelElement}>
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
             <div class="panel download-panel" data-testid="gallery-upload-panel" bind:this={uploadPanelElement}>
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
         <button class="button ghost" type="button" on:click={back} aria-label="Back to dialog list" data-testid="gallery-back-button">← Back</button>

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

          {#if $galleryViewMode === 'grid'}
            <button
              class="button secondary"
              type="button"
               on:click={() => {
                 const nextMode: GalleryLayoutMode = getNextLayoutMode(layoutMode)
                 $settings = { ...$settings, layoutMode: nextMode }
               }}
               aria-label="Toggle layout mode"
               use:tooltip={{ text: getLayoutModeTooltip(layoutMode) }}
              data-testid="gallery-layout-toggle"
            >
              {layoutMode === 'grid' ? 'Masonry' : 'Grid'}
            </button>
          {/if}

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
          class:active={$selectedFilter === filter.id}
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

    <AuthorFilter />

    {#if galleryStatusText}
      <p class="gallery-status muted" data-testid="gallery-data-status">{galleryStatusText}</p>
    {/if}

     {#if $galleryViewMode === 'grid'}
       {#if $effectiveDesktopLayout === 'sidebar'}
         <div class="desktop-sidebar">
           <div class="{gridClass}" style:grid-template-columns={shouldUseMasonry ? undefined : gridTemplate} data-testid="gallery-grid">
             {#each visibleItems as item, i (item.id)}
               <MediaItemCard
                 item={item}
                 onActivate={handleItemActivate}
                onLongPress={handleItemLongPress}
                selectionMode={$selectionMode}
                selected={$selectedMediaIds.has(item.id)}
                focused={focusedItemIndex === i}
                masonry={shouldUseMasonry}
              />
             {/each}
           </div>
           <DesktopSidebar currentMediaItem={selectedMediaItem} />
         </div>
       {:else if $effectiveDesktopLayout === 'dual'}
         <div class="desktop-dual">
           <div class="{gridClass}" style:grid-template-columns={shouldUseMasonry ? undefined : gridTemplate} data-testid="gallery-grid">
             {#each visibleItems as item, i (item.id)}
               <MediaItemCard
                 item={item}
                 onActivate={handleItemActivate}
                onLongPress={handleItemLongPress}
                selectionMode={$selectionMode}
                selected={$selectedMediaIds.has(item.id)}
                focused={focusedItemIndex === i}
                masonry={shouldUseMasonry}
              />
             {/each}
           </div>
           <div class="desktop-sidebar-panel">
             <h3>Dual Pane View</h3>
             <p class="muted">This pane could show previews, metadata, or additional controls.</p>
             {#if selectedMediaItem}
               <div class="metadata-item">
                 <div class="metadata-label">Selected Item</div>
                 <div class="metadata-value">{selectedMediaItem.filename}</div>
               </div>
             {:else}
               <div class="metadata-item">
                 <div class="metadata-label">No item selected</div>
                 <div class="metadata-value">Click on a media item to see details here</div>
               </div>
             {/if}
           </div>
         </div>
       {:else}
         <div class="{gridClass} {desktopLayoutClass}" style:grid-template-columns={shouldUseMasonry ? undefined : gridTemplate} data-testid="gallery-grid">
           {#each visibleItems as item, i (item.id)}
             <MediaItemCard
               item={item}
               onActivate={handleItemActivate}
                onLongPress={handleItemLongPress}
                selectionMode={$selectionMode}
                selected={$selectedMediaIds.has(item.id)}
                focused={focusedItemIndex === i}
                masonry={shouldUseMasonry}
              />
           {/each}
         </div>
       {/if}
      {:else}
       {#if $effectiveDesktopLayout === 'sidebar'}
         <div class="desktop-sidebar">
           <div class="list-view" data-testid="gallery-list">
             {#each visibleItems as item, i (item.id)}
               <MediaListRow
                 item={item}
                 onActivate={handleItemActivate}
                 onLongPress={handleItemLongPress}
                 selectionMode={$selectionMode}
                 selected={$selectedMediaIds.has(item.id)}
                 focused={focusedItemIndex === i}
               />
             {/each}
           </div>
           <DesktopSidebar currentMediaItem={selectedMediaItem} />
         </div>
       {:else if $effectiveDesktopLayout === 'dual'}
         <div class="desktop-dual">
           <div class="list-view" data-testid="gallery-list">
             {#each visibleItems as item, i (item.id)}
               <MediaListRow
                 item={item}
                 onActivate={handleItemActivate}
                 onLongPress={handleItemLongPress}
                 selectionMode={$selectionMode}
                 selected={$selectedMediaIds.has(item.id)}
                 focused={focusedItemIndex === i}
               />
             {/each}
           </div>
           <div class="desktop-sidebar-panel">
             <h3>Dual Pane View</h3>
             <p class="muted">This pane could show previews, metadata, or additional controls.</p>
             {#if selectedMediaItem}
               <div class="metadata-item">
                 <div class="metadata-label">Selected Item</div>
                 <div class="metadata-value">{selectedMediaItem.filename}</div>
               </div>
             {:else}
               <div class="metadata-item">
                 <div class="metadata-label">No item selected</div>
                 <div class="metadata-value">Click on a media item to see details here</div>
               </div>
             {/if}
           </div>
         </div>
       {:else}
         <div class="list-view {desktopLayoutClass}" data-testid="gallery-list">
           {#each visibleItems as item, i (item.id)}
             <MediaListRow
               item={item}
               onActivate={handleItemActivate}
               onLongPress={handleItemLongPress}
               selectionMode={$selectionMode}
               selected={$selectedMediaIds.has(item.id)}
               focused={focusedItemIndex === i}
             />
           {/each}
         </div>
       {/if}
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

    <div class="pull-refresh-note muted">Pull down to refresh gallery content.</div>

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
    background: var(--bg-surface-translucent);
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
    background: var(--bg-white-translucent-very-strong);
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
    background: var(--bg-white-translucent-weak);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .queue-item.queued {
    opacity: 0.8;
  }

  .queue-item.uploading {
    border-color: var(--border-accent-translucent);
    background: var(--bg-accent-translucent);
  }

  .queue-item.complete {
    border-color: var(--border-success-translucent);
    background: var(--bg-success-translucent);
  }

  .queue-item.error {
    border-color: var(--border-warning-translucent);
    background: var(--bg-warning-translucent);
  }

  .queue-item.cancelled {
    opacity: 0.6;
    border-color: var(--border-muted-translucent);
    background: var(--bg-muted-translucent);
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
    background: var(--bg-white-translucent-weak);
  }

  .filter-pill.active {
    color: var(--text-primary);
    background: var(--bg-accent-translucent-medium);
    border-color: var(--border-accent-translucent-strong);
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
  .pull-refresh-note,
  .gallery-status {
    padding: 12px 0 18px;
    text-align: center;
  }

  .pull-refresh-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated-translucent);
    backdrop-filter: blur(10px);
    z-index: 10;
    transition: transform 0.2s ease;
  }

  .pull-arrow,
  .refresh-spinner {
    font-size: 24px;
    margin-bottom: 6px;
    transition: transform 0.3s ease;
  }

  .refresh-spinner {
    animation: spin 1s linear infinite;
  }

  .pull-text,
  .refresh-text {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
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
