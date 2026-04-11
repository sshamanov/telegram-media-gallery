<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import { galleryFilters, isImageItem, matchesFilter, mediaTypeToFilter } from '../../lib/media'
  import { blobToFile, getCachedOrDownloadBlob, isAbortError, parseFloodWaitSeconds, saveBlob, sleep } from '../../lib/files'
  import MediaItemCard from './MediaItem.svelte'
  import MediaListRow from './MediaListRow.svelte'
  import { getTelegramAdapter } from '../../lib/telegram/adapter'
  import {
    cancelUploadQueue,
    cancelUploadQueueItem,
    currentDialog,
    enqueueUploadToCurrentDialog,
    galleryViewMode,
    hasMoreMedia,
    isLoadingMore,
    loadMoreMedia,
    loadState,
    mediaItems,
    openViewer,
    retryUploadQueueItem,
    scrollPositions,
    setActiveDialog,
    setGalleryViewMode,
    setUploadMode,
    storeScrollPosition,
    totalMessageCount,
    uploadQueueState,
  } from '../../stores/gallery'
  import { allDialogs, galleries, galleryIds, toggleGallery } from '../../stores/dialogs'
  import { settings } from '../../stores/settings'
  import { pushToast } from '../../stores/ui'
  import type { Dialog, GalleryFilterId, MediaItem, UploadMode as UploadModeType } from '../../types/telegram'

  interface DownloadState {
    active: boolean
    current: number
    total: number
    skipped: number
    fileName: string | null
    progress: number
    waitingSeconds: number | null
  }

  let scroller: HTMLElement | null = null
  let sentinel: HTMLDivElement | null = null
  let fileInput: HTMLInputElement | null = null
  let loadObserver: IntersectionObserver | null = null
  let lastDialogId: string | null = null
  let buffering = false
  let activeFilter: GalleryFilterId = 'all'
  let selectionMode = false
  let selectedIds: string[] = []
  let selectionAnchor: string | null = null
  let showUploadSheet = false
  let pendingUploadMode: UploadModeType = 'media'
  let showForwardSheet = false
  let forwardQuery = ''
  let forwardTargetId = ''
  let forwarding = false
  let forwardTab: 'galleries' | 'groups' | 'chats' = 'galleries'
  let downloadState: DownloadState = {
    active: false,
    current: 0,
    total: 0,
    skipped: 0,
    fileName: null,
    progress: 0,
    waitingSeconds: null,
  }
  let downloadCancelRequested = false
  let downloadAbortController: AbortController | null = null

  const filterOrder: GalleryFilterId[] = ['photos', 'videos', 'audio', 'docs']
  const shareLimitBytes = 200 * 1024 * 1024

  $: gridTemplate = `grid-template-columns: repeat(${$settings.gridColumns}, minmax(0, 1fr));`
  $: hiddenFilters = normalizeHiddenFilters($settings.defaultHiddenFilters ?? [])
  $: counts = countFilters($mediaItems)
  $: visibleItems = $mediaItems.filter((item) => isVisible(item, activeFilter, hiddenFilters))
  $: selectedItems = visibleItems.filter((item) => selectedIds.includes(item.id))
  $: selectedCount = selectedItems.length
  $: selectedSingleItem = selectedCount === 1 ? selectedItems[0] : null
  $: galleryTargets = filterDialogs($galleries, forwardQuery)
  $: groupTargets = filterDialogs(
    $allDialogs.filter((dialog) => dialog.kind === 'group'),
    forwardQuery,
  )
  $: chatTargets = filterDialogs(
    $allDialogs.filter((dialog) => dialog.kind === 'chat'),
    forwardQuery,
  )
  $: forwardTabItems = forwardTab === 'galleries'
    ? galleryTargets
    : forwardTab === 'groups'
      ? groupTargets
      : chatTargets
  $: canShareFiles = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
  $: canCopyImage = typeof navigator !== 'undefined'
    && typeof navigator.clipboard?.write === 'function'
    && typeof ClipboardItem !== 'undefined'
    && selectedSingleItem !== null
    && isImageItem(selectedSingleItem)

  function normalizeHiddenFilters(filters: GalleryFilterId[]): GalleryFilterId[] {
    const unique = [...new Set(filters.filter((filterId) => filterId !== 'all'))]
    return unique.length === filterOrder.length ? [] : unique
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

  function openById(itemId: string): void {
    const index = visibleItems.findIndex((item) => item.id === itemId)
    if (index >= 0) {
      openViewer(visibleItems, index)
    }
  }

  function back(): void {
    if ($currentDialog && scroller) {
      storeScrollPosition($currentDialog.id, scroller.scrollTop)
    }
    clearSelection()
    setActiveDialog(null)
  }

  function handleScroll(): void {
    if ($currentDialog && scroller) {
      storeScrollPosition($currentDialog.id, scroller.scrollTop)
    }

    if (!scroller || $isLoadingMore || !$hasMoreMedia || $mediaItems.length === 0) {
      return
    }

    const remainingPixels = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight)

    if (remainingPixels < scroller.clientHeight * 2) {
      void loadMoreMedia()
      void ensureBufferedViewport()
    }
  }

  async function restoreScroll(dialogId: string): Promise<void> {
    await tick()
    if (!scroller) {
      return
    }

    scroller.scrollTop = $scrollPositions[dialogId] ?? 0
  }

  function connectObserver(): void {
    loadObserver?.disconnect()
    if (!scroller || !sentinel) {
      return
    }

    loadObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreMedia()
      }
    }, {
      root: scroller,
      rootMargin: '1200px 0px',
    })

    loadObserver.observe(sentinel)
  }

  async function ensureBufferedViewport(): Promise<void> {
    if (!scroller || buffering) {
      return
    }

    buffering = true

    try {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (!$hasMoreMedia || $isLoadingMore || !scroller) {
          break
        }

        const remainingPixels = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight)
        if (remainingPixels > scroller.clientHeight * 1.5 && scroller.scrollHeight > scroller.clientHeight) {
          break
        }

        await loadMoreMedia()
        await tick()
      }
    } finally {
      buffering = false
    }
  }

  function toggleViewMode(): void {
    setGalleryViewMode($galleryViewMode === 'grid' ? 'list' : 'grid')
  }

  function selectFilter(filterId: GalleryFilterId): void {
    if (filterId !== 'all' && counts[filterId] === 0) {
      return
    }

    activeFilter = filterId
    pruneSelection()
  }

  function filterDialogs(dialogs: Dialog[], query: string): Dialog[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return dialogs
    }

    return dialogs.filter((dialog) =>
      dialog.title.toLowerCase().includes(normalized)
      || dialog.subtitle.toLowerCase().includes(normalized)
      || (dialog.username ?? '').toLowerCase().includes(normalized),
    )
  }

  function clearSelection(): void {
    selectionMode = false
    selectedIds = []
    selectionAnchor = null
    showForwardSheet = false
    forwardQuery = ''
    forwardTargetId = ''
  }

  function pruneSelection(): void {
    const visibleIds = new Set(visibleItems.map((item) => item.id))
    selectedIds = selectedIds.filter((itemId) => visibleIds.has(itemId))
    if (selectedIds.length === 0) {
      selectionMode = false
      selectionAnchor = null
    } else if (selectionAnchor && !visibleIds.has(selectionAnchor)) {
      selectionAnchor = selectedIds[selectedIds.length - 1] ?? null
    }
  }

  function enterSelection(itemId: string): void {
    selectionMode = true
    selectedIds = [itemId]
    selectionAnchor = itemId
  }

  function toggleSelection(itemId: string): void {
    selectionMode = true
    selectedIds = selectedIds.includes(itemId)
      ? selectedIds.filter((currentId) => currentId !== itemId)
      : [...selectedIds, itemId]
    selectionAnchor = itemId

    if (selectedIds.length === 0) {
      selectionMode = false
      selectionAnchor = null
    }
  }

  function selectRange(itemId: string): void {
    const ids = visibleItems.map((item) => item.id)
    const anchor = selectionAnchor ?? itemId
    const start = ids.indexOf(anchor)
    const end = ids.indexOf(itemId)
    if (start < 0 || end < 0) {
      enterSelection(itemId)
      return
    }

    const lower = Math.min(start, end)
    const upper = Math.max(start, end)
    selectedIds = ids.slice(lower, upper + 1)
    selectionMode = selectedIds.length > 0
    selectionAnchor = anchor
  }

  function selectAllVisible(): void {
    if (visibleItems.length === 0) {
      return
    }

    selectionMode = true
    selectedIds = visibleItems.map((item) => item.id)
    selectionAnchor = visibleItems[0]?.id ?? null
  }

  function handleItemActivate(itemId: string, event: MouseEvent): void {
    if (event.shiftKey) {
      selectRange(itemId)
      return
    }

    if (selectionMode || event.ctrlKey || event.metaKey) {
      toggleSelection(itemId)
      return
    }

    openById(itemId)
  }

  function handleItemLongPress(itemId: string): void {
    if (!selectionMode) {
      navigator.vibrate?.(50)
      enterSelection(itemId)
      return
    }

    toggleSelection(itemId)
  }

  function requestUpload(mode: UploadModeType): void {
    pendingUploadMode = mode
    setUploadMode(mode)
    showUploadSheet = false
    fileInput?.click()
  }

  async function handleUpload(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement
    const files = input.files ? Array.from(input.files) : []
    if (files.length === 0) {
      return
    }

    try {
      await enqueueUploadToCurrentDialog(files, pendingUploadMode)
      const completeCount = $uploadQueueState.items.filter((item) => item.status === 'complete').length
      const failedCount = $uploadQueueState.items.filter((item) => item.status === 'error').length
      const cancelledCount = $uploadQueueState.items.filter((item) => item.status === 'cancelled').length
      const parts = [`Uploaded ${completeCount} file${completeCount === 1 ? '' : 's'}`]
      if (failedCount > 0) {
        parts.push(`${failedCount} failed`)
      }
      if (cancelledCount > 0) {
        parts.push(`${cancelledCount} cancelled`)
      }
      pushToast({ kind: failedCount > 0 ? 'warning' : 'success', text: parts.join(', '), dismissible: true })
    } catch (error) {
      pushToast({ kind: 'error', text: error instanceof Error ? error.message : 'Upload failed', dismissible: true })
    } finally {
      input.value = ''
    }
  }

  function cancelDownloads(): void {
    if (!downloadState.active) {
      return
    }

    downloadCancelRequested = true
    downloadAbortController?.abort()
  }

  async function withFloodWait<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    while (true) {
      const controller = new AbortController()
      downloadAbortController = controller

      try {
        downloadState.waitingSeconds = null
        return await run(controller.signal)
      } catch (error) {
        if (controller.signal.aborted) {
          throw error
        }

        const waitSeconds = parseFloodWaitSeconds(error)
        if (!waitSeconds) {
          throw error
        }

        downloadState.waitingSeconds = waitSeconds
        for (let remaining = waitSeconds; remaining > 0; remaining -= 1) {
          downloadState.waitingSeconds = remaining
          await sleep(1000)
        }
      } finally {
        if (downloadAbortController === controller) {
          downloadAbortController = null
        }
      }
    }
  }

  async function tryDownloadToDirectory(items: MediaItem[]): Promise<boolean> {
    if (typeof window.showDirectoryPicker !== 'function') {
      return false
    }

    try {
      const directory = await window.showDirectoryPicker()
      let completed = 0

      for (const [index, item] of items.entries()) {
        if (downloadCancelRequested) {
          break
        }

        downloadState.current = index + 1
        downloadState.fileName = item.filename
        downloadState.progress = 0

        try {
          const blob = await withFloodWait((signal) => getCachedOrDownloadBlob(item, 'full', {
            abortSignal: signal,
            onProgress: (progress) => {
              downloadState.progress = progress
            },
          }).then((result) => {
            if (!result) {
              throw new Error('Download failed')
            }
            return result
          }))
          const handle = await directory.getFileHandle(item.filename, { create: true })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          completed += 1
        } catch (error) {
          if (isAbortError(error) && downloadCancelRequested) {
            break
          }

          downloadState.skipped += 1
        }
      }

      const attempted = completed + downloadState.skipped
      if (downloadCancelRequested) {
        pushToast({ kind: 'warning', text: `Downloaded ${completed} / ${items.length}, cancelled`, dismissible: true })
      } else if (downloadState.skipped > 0) {
        pushToast({ kind: 'warning', text: `Downloaded ${completed} / ${items.length}, ${downloadState.skipped} failed`, dismissible: true })
      } else if (attempted > 0) {
        pushToast({ kind: 'success', text: `Downloaded ${completed} files`, dismissible: true })
      }

      return true
    } catch {
      return false
    }
  }

  async function downloadSelected(): Promise<void> {
    if (selectedItems.length === 0) {
      return
    }

    downloadCancelRequested = false
    downloadState = {
      active: true,
      current: 0,
      total: selectedItems.length,
      skipped: 0,
      fileName: null,
      progress: 0,
      waitingSeconds: null,
    }

    const usedDirectory = await tryDownloadToDirectory(selectedItems)
    if (!usedDirectory) {
      let completed = 0

      for (const [index, item] of selectedItems.entries()) {
        if (downloadCancelRequested) {
          break
        }

        downloadState.current = index + 1
        downloadState.fileName = item.filename
        downloadState.progress = 0

        try {
          const blob = await withFloodWait((signal) => getCachedOrDownloadBlob(item, 'full', {
            abortSignal: signal,
            onProgress: (progress) => {
              downloadState.progress = progress
            },
          }).then((result) => {
            if (!result) {
              throw new Error('Download failed')
            }
            return result
          }))
          saveBlob(blob, item.filename)
          completed += 1
          await sleep(100)
        } catch (error) {
          if (isAbortError(error) && downloadCancelRequested) {
            break
          }

          downloadState.skipped += 1
        }
      }

      if (downloadCancelRequested) {
        pushToast({ kind: 'warning', text: `Downloaded ${completed} / ${selectedItems.length}, cancelled`, dismissible: true })
      } else if (downloadState.skipped > 0) {
        pushToast({ kind: 'warning', text: `Downloaded ${completed} / ${selectedItems.length}, ${downloadState.skipped} failed`, dismissible: true })
      } else {
        pushToast({ kind: 'success', text: `Downloaded ${completed} files`, dismissible: true })
      }
    }

    downloadState.active = false
    downloadState.fileName = null
    downloadState.progress = 0
    downloadState.waitingSeconds = null
    if (!downloadCancelRequested) {
      clearSelection()
    }
  }

  async function shareItems(items: MediaItem[]): Promise<void> {
    if (!canShareFiles || items.length === 0) {
      return
    }

    const tooLarge = items.find((item) => item.size > shareLimitBytes)
    if (tooLarge) {
      pushToast({ kind: 'warning', text: 'File too large to share directly. Use Download instead.', dismissible: true })
      return
    }

    try {
      const files: File[] = []
      for (const item of items) {
        const blob = await getCachedOrDownloadBlob(item, 'full')
        if (!blob) {
          throw new Error(`Unable to prepare ${item.filename}`)
        }
        files.push(blobToFile(blob, item.filename))
      }

      if (!navigator.canShare({ files })) {
        pushToast({ kind: 'warning', text: 'Sharing is not supported on this device', dismissible: true })
        return
      }

      await navigator.share({ files, title: items.length === 1 ? items[0].filename : `Share ${items.length} items` })
      clearSelection()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      pushToast({ kind: 'error', text: error instanceof Error ? error.message : 'Share failed', dismissible: true })
    }
  }

  async function copySelectedImage(): Promise<void> {
    if (!canCopyImage || !selectedSingleItem) {
      return
    }

    try {
      const blob = await getCachedOrDownloadBlob(selectedSingleItem, 'full')
      if (!blob) {
        throw new Error('Unable to prepare image')
      }

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob }),
      ])
      pushToast({ kind: 'success', text: 'Image copied to clipboard', dismissible: true })
    } catch (error) {
      pushToast({ kind: 'error', text: error instanceof Error ? error.message : 'Copy failed', dismissible: true })
    }
  }

  function openForwardSheet(): void {
    if (selectedItems.length === 0) {
      return
    }

    showForwardSheet = true
    forwardQuery = ''
    forwardTargetId = ''
  }

  async function forwardSelected(): Promise<void> {
    if (!$currentDialog || !forwardTargetId || selectedItems.length === 0) {
      return
    }

    forwarding = true

    try {
      await withForwardFloodWait(() =>
        Promise.resolve(getTelegramAdapter().forwardMessages(
          forwardTargetId,
          $currentDialog.id,
          selectedItems.map((item) => item.messageId),
        )),
      )
      const target = [...$galleries, ...$allDialogs].find((dialog) => dialog.id === forwardTargetId)
      pushToast({ kind: 'success', text: `Forwarded ${selectedItems.length} items to ${target?.title ?? 'selected chat'}`, dismissible: true })
      clearSelection()
    } catch (error) {
      pushToast({ kind: 'error', text: error instanceof Error ? error.message : 'Forward failed', dismissible: true })
    } finally {
      forwarding = false
    }
  }

  async function withForwardFloodWait<T>(run: () => Promise<T>): Promise<T> {
    while (true) {
      try {
        return await run()
      } catch (error) {
        const waitSeconds = parseFloodWaitSeconds(error)
        if (!waitSeconds) {
          throw error
        }

        pushToast({ kind: 'info', text: `Waiting ${waitSeconds}s for Telegram rate limit`, dismissible: true })
        await sleep(waitSeconds * 1000)
      }
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (showForwardSheet) {
        showForwardSheet = false
        return
      }

      if (selectionMode) {
        clearSelection()
      }
    }
  }

  $: if ($currentDialog?.id && lastDialogId !== $currentDialog.id) {
    lastDialogId = $currentDialog.id
    activeFilter = 'all'
    clearSelection()
    void restoreScroll($currentDialog.id)
  }

  $: if (activeFilter !== 'all' && counts[activeFilter] === 0) {
    activeFilter = 'all'
  }

  $: pruneSelection()

  $: if ($mediaItems.length >= 0) {
    connectObserver()
    void ensureBufferedViewport()
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    loadObserver?.disconnect()
    window.removeEventListener('keydown', handleKeydown)
  })
</script>

{#if $currentDialog}
  <section bind:this={scroller} class="gallery-shell" on:scroll={handleScroll}>
    <header class="panel gallery-header">
      <button class="button ghost" type="button" on:click={back}>← Back</button>
      <div class="title-block">
        <h2>{$currentDialog.title}</h2>
        <div class="muted count-label">
          {visibleItems.length} visible{$mediaItems.length !== visibleItems.length ? ` / ${$mediaItems.length} loaded` : ' media loaded'}{$totalMessageCount !== null ? ` (${$totalMessageCount} total messages)` : ''}
        </div>
      </div>

      {#if selectionMode}
        <div class="actions selection-actions">
          <div class="selection-count">{selectedCount} selected</div>
          <button class="button secondary" type="button" on:click={selectAllVisible}>Select all</button>
          <button class="button secondary" type="button" on:click={downloadSelected} disabled={selectedCount === 0}>⬇ Download</button>
          <button class="button secondary" type="button" on:click={openForwardSheet} disabled={selectedCount === 0}>→ Forward</button>
          {#if canShareFiles}
            <button class="button secondary" type="button" on:click={() => shareItems(selectedItems)} disabled={selectedCount === 0}>↑ Share</button>
          {/if}
          <button class="button secondary" type="button" on:click={copySelectedImage} disabled={!canCopyImage} title={canCopyImage ? 'Copy image' : 'Select one image to copy'}>⧉ Copy</button>
          <button class="button ghost" type="button" on:click={clearSelection}>✕ Cancel</button>
        </div>
      {:else}
        <div class="actions">
          <button class="button secondary" type="button" on:click={toggleViewMode}>{$galleryViewMode === 'grid' ? '⊟' : '⊞'}</button>
          <button class="button secondary" type="button">{$settings.gridColumns}x</button>
          <button class="button {$galleryIds.includes($currentDialog.id) ? 'danger' : 'secondary'}" type="button" on:click={() => toggleGallery($currentDialog.id)}>
            ★
          </button>
          <button class="button secondary" type="button" on:click={() => (showUploadSheet = !showUploadSheet)}>⬆ Upload</button>
        </div>
      {/if}
    </header>

    {#if showUploadSheet && !selectionMode}
      <div class="panel upload-sheet">
        <button class="button secondary" type="button" on:click={() => requestUpload('media')}>Upload as media</button>
        <button class="button secondary" type="button" on:click={() => requestUpload('file')}>Upload as file</button>
      </div>
    {/if}

    <input bind:this={fileInput} class="sr-only" type="file" multiple on:change={handleUpload} />

    <div class="filter-bar">
      {#each galleryFilters as filter}
        <button
          class:active={activeFilter === filter.id}
          class={`filter-pill ${filter.id !== 'all' && hiddenFilters.includes(filter.id) ? 'hidden-default' : ''}`}
          type="button"
          disabled={filter.id !== 'all' && counts[filter.id] === 0}
          on:click={() => selectFilter(filter.id)}
        >
          {filter.label}
        </button>
      {/each}
    </div>

    {#if $galleryViewMode === 'grid'}
      <div class="grid" style={gridTemplate}>
        {#each visibleItems as item (item.id)}
          <MediaItemCard
            item={item}
            selected={selectedIds.includes(item.id)}
            selectionMode={selectionMode}
            onActivate={handleItemActivate}
            onLongPress={handleItemLongPress}
          />
        {/each}
      </div>
    {:else}
      <div class="list-view">
        {#each visibleItems as item (item.id)}
          <MediaListRow
            item={item}
            selected={selectedIds.includes(item.id)}
            selectionMode={selectionMode}
            onActivate={handleItemActivate}
            onLongPress={handleItemLongPress}
          />
        {/each}
      </div>
    {/if}

    {#if visibleItems.length === 0 && $mediaItems.length > 0}
      <div class="empty-state muted">No items match the current filter.</div>
    {/if}

    {#if $loadState === 'loading' || $isLoadingMore}
      <div class="loading muted">Loading media...</div>
    {/if}

    {#if !$isLoadingMore && !$hasMoreMedia && visibleItems.length > 0}
      <div class="loading muted">All media loaded</div>
    {/if}

    <div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
  </section>

  <!-- Fixed bottom bar: download progress -->
  {#if downloadState.active}
    <div class="bottom-bar panel">
      <div class="bottom-bar-body">
        <div class="bottom-bar-copy">
          <div class="upload-title">Downloading {downloadState.current} / {downloadState.total}</div>
          <div class="muted bottom-bar-sub">
            {downloadState.fileName ?? 'Preparing files...'}
            {#if downloadState.waitingSeconds !== null}
              · Waiting {downloadState.waitingSeconds}s (rate limit)
            {/if}
            {#if downloadState.skipped > 0}
              · {downloadState.skipped} failed
            {/if}
          </div>
        </div>
        <div class="bottom-bar-progress">
          <div class="upload-bar"><span style={`width:${downloadState.progress}%`}></span></div>
          <div class="muted upload-meta">{downloadState.progress}%</div>
        </div>
      </div>
      <button class="button ghost" type="button" on:click={cancelDownloads}>✕</button>
    </div>
  {/if}

  <!-- Fixed bottom bar: upload queue -->
  {#if $uploadQueueState.items.length > 0}
    <div class="bottom-bar panel upload-queue-bar">
      <div class="bottom-bar-body">
        <div class="bottom-bar-copy">
          <div class="upload-title">Uploading {Math.max($uploadQueueState.currentIndex + 1, 0)} / {$uploadQueueState.items.length}</div>
          <div class="muted bottom-bar-sub">Mode: {$uploadQueueState.mode === 'file' ? 'Send as file' : 'Send as media'}</div>
        </div>
        <button class="button ghost" type="button" on:click={cancelUploadQueue}>✕ Cancel all</button>
      </div>
      <div class="queue-list">
        {#each $uploadQueueState.items as item (item.id)}
          <div class="queue-row">
            <div class="queue-copy">
              <div class="queue-name">{item.fileName}</div>
              <div class="muted queue-state">{item.status}{item.error ? ` — ${item.error}` : ''}</div>
            </div>
            <div class="queue-bar"><span style={`width:${item.progress}%`}></span></div>
            <div class="queue-actions">
              {#if item.status === 'error'}
                <button class="button secondary compact-action" type="button" on:click={() => retryUploadQueueItem(item.id)}>Retry</button>
              {:else if item.status === 'queued' || item.status === 'uploading'}
                <button class="button ghost compact-action" type="button" on:click={() => cancelUploadQueueItem(item.id)}>✕</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if showForwardSheet}
    <button class="sheet-backdrop" type="button" aria-label="Close forward picker" on:click={() => (showForwardSheet = false)}></button>
    <section class="panel forward-sheet">
      <!-- Fixed header -->
      <div class="sheet-head">
        <div class="sheet-title-row">
          <div>
            <h3>Forward {selectedCount} items</h3>
            <div class="muted">Choose one destination</div>
          </div>
          <button class="button ghost" type="button" on:click={() => (showForwardSheet = false)}>✕</button>
        </div>

        <input class="search" bind:value={forwardQuery} placeholder="Search..." />

        <div class="sheet-tabs">
          <button class:tab-active={forwardTab === 'galleries'} class="sheet-tab" type="button" on:click={() => (forwardTab = 'galleries')}>
            Galleries <span class="tab-count">{galleryTargets.length}</span>
          </button>
          <button class:tab-active={forwardTab === 'groups'} class="sheet-tab" type="button" on:click={() => (forwardTab = 'groups')}>
            Groups <span class="tab-count">{groupTargets.length}</span>
          </button>
          <button class:tab-active={forwardTab === 'chats'} class="sheet-tab" type="button" on:click={() => (forwardTab = 'chats')}>
            Chats <span class="tab-count">{chatTargets.length}</span>
          </button>
        </div>
      </div>

      <!-- Scrollable list -->
      <div class="sheet-list">
        {#if forwardTabItems.length === 0}
          <div class="muted sheet-empty">No results</div>
        {:else}
          {#each forwardTabItems as dialog (dialog.id)}
            <button class:active-target={forwardTargetId === dialog.id} class="target-row" type="button" on:click={() => (forwardTargetId = dialog.id)}>
              <span class="target-title">{dialog.title}</span>
              <span class="muted target-sub">{dialog.subtitle}</span>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Fixed footer -->
      <div class="sheet-foot">
        <button class="button" type="button" disabled={!forwardTargetId || forwarding} on:click={forwardSelected}>
          {forwarding ? 'Forwarding...' : `Forward ${selectedCount} items`}
        </button>
      </div>
    </section>
  {/if}
{/if}

<style>
  .gallery-shell {
    display: grid;
    gap: 16px;
    max-height: calc(100vh - 72px);
    max-height: calc(100dvh - 72px);
    overflow: auto;
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

  h2,
  h3 {
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

  .selection-actions {
    flex: 1;
  }

  .selection-count {
    min-width: 88px;
    font-weight: 600;
  }

  .upload-sheet {
    display: flex;
    gap: 10px;
    padding: 12px;
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
  .loading {
    padding: 12px 0 18px;
    text-align: center;
  }

  .sentinel {
    height: 1px;
  }

  /* ── fixed bottom bars ──────────────────────────────────────── */

  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: min(var(--content-width), 100vw);
    z-index: 30;
    padding: 12px 16px;
    display: grid;
    gap: 10px;
    background: rgba(30, 30, 30, 0.96);
    backdrop-filter: blur(20px);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .bottom-bar-body {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .bottom-bar-copy {
    flex: 1;
    min-width: 0;
  }

  .bottom-bar-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 180px;
  }

  .bottom-bar-progress .upload-bar {
    flex: 1;
  }

  .bottom-bar-sub {
    margin-top: 3px;
    font-size: 0.88rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .upload-queue-bar .queue-list {
    max-height: 210px;
    overflow: auto;
  }

  /* ── shared upload/download elements ───────────────────────── */

  .upload-title {
    font-weight: 600;
  }

  .upload-bar,
  .queue-bar {
    overflow: hidden;
    height: 10px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
  }

  .upload-bar span,
  .queue-bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  .upload-meta {
    font-size: 0.86rem;
    white-space: nowrap;
  }

  .queue-list {
    display: grid;
    gap: 10px;
  }

  .queue-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(120px, 1fr) auto;
    gap: 12px;
    align-items: center;
  }

  .queue-name,
  .queue-state {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .queue-name {
    font-weight: 600;
  }

  .compact-action {
    padding: 8px 12px;
  }

  /* ── forward sheet ───────────────────────────────────────── */

  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 0;
    width: 100%;
    height: 100%;
  }

  .forward-sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    z-index: 41;
    width: min(720px, 100vw);
    height: min(80vh, 760px);
    transform: translateX(-50%);
    display: grid;
    grid-template-rows: auto 1fr auto;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    overflow: hidden;
    padding: 0;
  }

  .sheet-head {
    display: grid;
    gap: 12px;
    padding: 16px 16px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 12px;
  }

  .sheet-title-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
  }

  .sheet-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin: 0 -16px;
    padding: 0 16px;
  }

  .sheet-tab {
    border: 0;
    padding: 10px 14px;
    color: var(--text-secondary);
    background: transparent;
    border-bottom: 2px solid transparent;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sheet-tab.tab-active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-count {
    font-size: 0.78rem;
    opacity: 0.7;
  }

  .sheet-list {
    overflow: auto;
    padding: 12px 16px;
    display: grid;
    align-content: start;
    gap: 8px;
  }

  .sheet-empty {
    padding: 28px 0;
    text-align: center;
  }

  .sheet-foot {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sheet-foot .button {
    width: 100%;
  }

  .target-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px 12px;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    color: inherit;
    background: rgba(255, 255, 255, 0.02);
    text-align: left;
  }

  .target-title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .target-sub {
    font-size: 0.86rem;
    grid-column: 1 / -1;
  }

  .target-row.active-target {
    border-color: rgba(0, 136, 204, 0.45);
    background: rgba(0, 136, 204, 0.2);
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

    .actions,
    .selection-actions {
      width: 100%;
      justify-content: flex-start;
    }

    .upload-sheet {
      flex-direction: column;
    }

    .queue-row {
      grid-template-columns: 1fr;
    }

    .bottom-bar {
      left: 0;
      transform: none;
      width: 100%;
    }

    .bottom-bar-progress {
      min-width: 100px;
    }

    .forward-sheet {
      width: 100%;
      left: 0;
      transform: none;
    }
  }
</style>
