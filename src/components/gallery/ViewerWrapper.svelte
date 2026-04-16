<script lang="ts">
  import { derived, get, type Readable } from 'svelte/store'
  import { onDestroy } from 'svelte'
  import PhotoSwipe from 'photoswipe'
  import { blobToFile, getCachedBlob, getCachedOrDownloadBlob } from '../../lib/files'
  import { formatSize, isAudioItem, isDownloadOnlyItem, isImageItem, isPdfItem, isTextItem, isTextLikeFileName, isVideoItem, mediaKindLabel } from '../../lib/media'
  import { readTextBlob } from '../../lib/thumbnails'
  import { createGallerySwipeGestures } from '../../lib/dom/swipe-gestures'
  import {
    closeViewer,
    mediaItems,
    setViewerIndex,
    viewerIndex,
    viewerItems,
  } from '../../stores/gallery'
  import { isOffline, pushToast } from '../../stores/ui'
  import { getRouter } from '../../lib/routing'
  import type { Route } from '../../lib/routing'
  import InfoPanel from './InfoPanel.svelte'
  import type { MediaItem } from '../../types/telegram'
  import type { SlideData } from 'photoswipe'

  type ViewerContent = Record<string, unknown> & {
    element?: HTMLElement
    data?: { item?: MediaItem }
    previewUrl?: string | null
    fullUrl?: string | null
    width?: number
    height?: number
    slide?: {
      width: number
      height: number
      updateContentSize: (force?: boolean) => void
      zoomAndPanToInitial: () => void
      applyCurrentZoomPan: () => void
    }
  }

  let showInfo = false
  let pswp: PhotoSwipe | null = null
  let pswpOpenToken = 0
  let loadProgress = 0

  const shareLimitBytes = 200 * 1024 * 1024

  const activeItem: Readable<MediaItem | null> = derived([viewerItems, mediaItems, viewerIndex], ([$viewerItems, $mediaItems, $viewerIndex]) =>
    $viewerIndex === null ? null : ($viewerItems[$viewerIndex] ?? $mediaItems[$viewerIndex] ?? null),
  )

  async function getCachedOrDownloadedBlob(item: MediaItem, kind: 'thumb' | 'full', token: number): Promise<Blob | null> {
    if ($isOffline) {
      return getCachedBlob(item, kind)
    }

    if (token !== pswpOpenToken) return null

    return getCachedOrDownloadBlob(item, kind, {
      onProgress: (pct) => {
        if (token === pswpOpenToken) loadProgress = pct
      },
    }).then((blob) => (token === pswpOpenToken ? blob : null))
  }

  function revokeUrls(content: ViewerContent): void {
    if (typeof content.previewUrl === 'string') {
      URL.revokeObjectURL(content.previewUrl)
      content.previewUrl = null
    }

    if (typeof content.fullUrl === 'string') {
      URL.revokeObjectURL(content.fullUrl)
      content.fullUrl = null
    }
  }

  function createDataSource(items: MediaItem[]): SlideData[] {
    return items.map((item) => ({
      type: isImageItem(item) ? 'image' : 'html',
      html: isImageItem(item) ? undefined : '<div class="pswp__content"></div>',
      src: isImageItem(item) ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' : undefined,
      width: item.width || (isVideoItem(item) ? 1280 : isPdfItem(item) || isTextItem(item) || isAudioItem(item) ? 960 : 1600),
      height: item.height || (isVideoItem(item) ? 720 : isPdfItem(item) || isTextItem(item) || isAudioItem(item) ? 720 : 1200),
      alt: item.filename,
      item,
    }))
  }

  function createShell(className: string): HTMLDivElement {
    const wrapper = document.createElement('div')
    wrapper.className = className
    return wrapper
  }

  function markLoaded(event: { content: { onLoaded: () => void } }): void {
    event.content.onLoaded()
  }

  function renderOfflinePlaceholder(content: ViewerContent): void {
    const wrapper = createShell('viewer-fallback viewer-offline')
    wrapper.dataset.testid = 'viewer-offline-placeholder'
    const icon = document.createElement('div')
    icon.className = 'viewer-offline-icon'
    icon.textContent = '📵'
    const title = document.createElement('h3')
    title.textContent = 'Not available offline'
    const sub = document.createElement('p')
    sub.textContent = 'This item is not cached. Connect to load it.'
    wrapper.append(icon, title, sub)
    content.element = wrapper
  }

  function replaceImageSource(content: ViewerContent, item: MediaItem, image: HTMLImageElement, nextUrl: string, options?: {
    revokePreviewOnLoad?: boolean
  }): void {
    const previousFullUrl = typeof content.fullUrl === 'string' ? content.fullUrl : null
    image.onload = () => {
      updateImageDimensions(content, item, image)

      if (options?.revokePreviewOnLoad && typeof content.previewUrl === 'string') {
        URL.revokeObjectURL(content.previewUrl)
        content.previewUrl = null
      }

      if (previousFullUrl && previousFullUrl !== nextUrl) {
        URL.revokeObjectURL(previousFullUrl)
      }
    }
    content.fullUrl = nextUrl
    image.src = nextUrl
  }

  function renderDownloadOnly(content: ViewerContent, item: MediaItem): void {
    const wrapper = createShell('viewer-fallback')
    const title = document.createElement('h3')
    title.textContent = item.filename
    const subtitle = document.createElement('p')
    subtitle.textContent = `${mediaKindLabel(item)} preview is not available in-browser. Download the file to open it.`
    wrapper.append(title, subtitle)
    content.element = wrapper
  }

  function renderText(content: ViewerContent, blob: Blob): void {
    const wrapper = createShell('viewer-text-wrap')
    const pre = document.createElement('pre')
    pre.textContent = 'Loading text...'
    wrapper.appendChild(pre)
    content.element = wrapper
    void readTextBlob(blob).then((text) => {
      pre.textContent = text
    }).catch(() => {
      pre.textContent = 'Unable to render this text file.'
    })
  }

  function renderAudio(content: ViewerContent, item: MediaItem, blob: Blob): void {
    const wrapper = createShell('viewer-audio-wrap')
    const title = document.createElement('h3')
    title.className = 'viewer-audio-title'
    title.textContent = item.filename
    const audio = document.createElement('audio')
    audio.className = 'viewer-audio'
    audio.controls = true
    audio.preload = 'metadata'
    const fullUrl = URL.createObjectURL(blob)
    content.fullUrl = fullUrl
    audio.src = fullUrl
    audio.load()
    wrapper.append(title, audio)
    content.element = wrapper
  }

  function renderPdf(content: ViewerContent, blob: Blob): void {
    const wrapper = createShell('viewer-pdf-wrap')
    const embed = document.createElement('embed')
    const fullUrl = URL.createObjectURL(blob)
    content.fullUrl = fullUrl
    embed.src = fullUrl
    embed.type = 'application/pdf'
    embed.className = 'viewer-pdf'
    wrapper.appendChild(embed)
    content.element = wrapper
  }

  function renderImage(content: ViewerContent, blob: Blob, alt: string): void {
    const image = document.createElement('img')
    image.className = 'pswp__img'
    image.alt = alt
    const fullUrl = URL.createObjectURL(blob)
    content.fullUrl = fullUrl
    image.src = fullUrl
    content.element = image
  }

  function updateImageDimensions(content: ViewerContent, item: MediaItem, image: HTMLImageElement): void {
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (!width || !height) {
      return
    }

    item.width = width
    item.height = height
    content.width = width
    content.height = height

    if (content.slide) {
      content.slide.width = width
      content.slide.height = height
      content.slide.zoomAndPanToInitial()
      content.slide.applyCurrentZoomPan()
      content.slide.updateContentSize(true)
    }
  }

  async function handleContentLoad(content: ViewerContent, item: MediaItem, token: number, event: { content: { onLoaded: () => void }; preventDefault: () => void }): Promise<void> {
    event.preventDefault()

    // Offline: check cache first, show placeholder if not cached
    if ($isOffline) {
      const cachedFullBlob = await getCachedBlob(item, 'full')
      if (!cachedFullBlob) {
        renderOfflinePlaceholder(content)
        markLoaded(event)
        return
      }
    }

    if (isTextItem(item) || isTextLikeFileName(item.filename)) {
      const fullBlob = await getCachedOrDownloadedBlob(item, 'full', token)
      if (!fullBlob || token !== pswpOpenToken) {
        return
      }

      renderText(content, fullBlob)
      loadProgress = 100
      markLoaded(event)
      return
    }

    if (isDownloadOnlyItem(item)) {
      renderDownloadOnly(content, item)
      markLoaded(event)
      loadProgress = 100
      return
    }

    if (isImageItem(item)) {
      const image = document.createElement('img')
      image.className = 'pswp__img'
      image.alt = item.filename
      content.element = image

      const previewBlob = await getCachedOrDownloadedBlob(item, 'thumb', token)
      if (previewBlob && token === pswpOpenToken) {
        const previewUrl = URL.createObjectURL(previewBlob)
        if (typeof content.previewUrl === 'string') {
          URL.revokeObjectURL(content.previewUrl)
        }
        content.previewUrl = previewUrl
        image.onload = () => updateImageDimensions(content, item, image)
        image.src = previewUrl
        markLoaded(event)
      }

      const fullBlob = await getCachedOrDownloadedBlob(item, 'full', token)
      if (!fullBlob || token !== pswpOpenToken) {
        return
      }

      const fullUrl = URL.createObjectURL(fullBlob)
      replaceImageSource(content, item, image, fullUrl, { revokePreviewOnLoad: true })
      loadProgress = 100
      markLoaded(event)
      return
    }

    if (isVideoItem(item)) {
      const wrapper = createShell('viewer-video-wrap pswp__content')
      const video = document.createElement('video')
      video.className = 'viewer-video'
      video.controls = true
      video.playsInline = true
      wrapper.appendChild(video)
      content.element = wrapper

      markLoaded(event)

      const fullBlob = await getCachedOrDownloadedBlob(item, 'full', token)
      if (!fullBlob || token !== pswpOpenToken) {
        return
      }

      const fullUrl = URL.createObjectURL(fullBlob)
      content.fullUrl = fullUrl
      video.src = fullUrl
      loadProgress = 100
      markLoaded(event)
      return
    }

    const fullBlob = await getCachedOrDownloadedBlob(item, 'full', token)
    if (!fullBlob || token !== pswpOpenToken) {
      return
    }

    if (isPdfItem(item)) {
      renderPdf(content, fullBlob)
    } else if (isAudioItem(item)) {
      renderAudio(content, item, fullBlob)
    } else {
      renderImage(content, fullBlob, item.filename)
    }

    loadProgress = 100
    markLoaded(event)
  }

  function attachPhotoSwipe(): void {
    const items = get(viewerItems).length > 0 ? get(viewerItems) : get(mediaItems)
    const index = get(viewerIndex)
    if (index === null || items.length === 0) {
      return
    }

    pswpOpenToken += 1
    const token = pswpOpenToken
    showInfo = false
    loadProgress = 0

    pswp?.destroy()
    pswp = new PhotoSwipe({
      dataSource: createDataSource(items),
      index,
      bgOpacity: 0.92,
      close: false,
      zoom: false,
      counter: false,
      arrowPrev: false,
      arrowNext: false,
      secondaryZoomLevel: 2,
      maxZoomLevel: (zoomLevelObject) => {
        const item = zoomLevelObject.itemData.item as MediaItem | undefined
        return item && isImageItem(item) ? 4 : 1
      },
      wheelToZoom: true,
      imageClickAction: 'zoom-or-close',
      paddingFn: () => ({ top: 88, right: 24, bottom: 92, left: 24 }),
    })

    pswp.addFilter('isContentZoomable', (isZoomable, content) => {
      const item = (content.data as { item?: MediaItem } | undefined)?.item
      return item ? isImageItem(item) : isZoomable
    })

    pswp.on('change', () => {
      if (pswp) {
        setViewerIndex(pswp.currIndex)
        loadProgress = 0
      }
    })

    pswp.on('close', () => {
      closeViewer()
    })

    pswp.on('contentLoad', (event) => {
      const content = event.content as ViewerContent
      const item = content.data?.item ?? null
      if (!item) {
        return
      }

      void handleContentLoad(content, item, token, event)
    })

    pswp.on('contentDestroy', (event) => {
      revokeUrls(event.content as ViewerContent)
    })

    pswp.on('destroy', () => {
      pswp = null
      pswpOpenToken += 1
    })

    pswp.init()
  }

  async function downloadCurrent(): Promise<void> {
    const item = get(activeItem)
    if (!item) {
      return
    }

    if ($isOffline) {
      pushToast({
        kind: 'warning',
        text: 'Downloads are unavailable offline unless the file is already open in the viewer cache.',
        dismissible: true,
      })
      return
    }

    const blob = await getCachedOrDownloadedBlob(item, 'full', pswpOpenToken)
    if (!blob) {
      return
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = item.filename
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function shareCurrent(): Promise<void> {
    const item = get(activeItem)
    if (!item || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      return
    }

    if ($isOffline) {
      pushToast({
        kind: 'warning',
        text: 'Sharing is unavailable offline because uncached media cannot be fetched.',
        dismissible: true,
      })
      return
    }

    if (item.size > shareLimitBytes) {
      return
    }

    const blob = await getCachedOrDownloadedBlob(item, 'full', pswpOpenToken)
    if (!blob) {
      return
    }

    const file = blobToFile(blob, item.filename)
    if (!navigator.canShare({ files: [file] })) {
      return
    }

    await navigator.share({ files: [file], title: item.filename })
  }

  async function copyCurrent(): Promise<void> {
    const item = get(activeItem)
    if (!item || !isImageItem(item) || typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined') {
      return
    }

    const blob = await getCachedOrDownloadedBlob(item, 'full', pswpOpenToken)
    if (!blob) {
      return
    }

    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || 'image/png']: blob }),
    ])
  }

  async function copyLink(): Promise<void> {
    const item = get(activeItem)
    if (!item || typeof navigator.clipboard?.writeText !== 'function') {
      return
    }

    const route: Route = { type: 'viewer', dialogId: item.dialogId, messageId: item.messageId }
    const url = getRouter().getUrl(route)
    const fullUrl = window.location.origin + window.location.pathname + url
    try {
      await navigator.clipboard.writeText(fullUrl)
      pushToast({
        kind: 'success',
        text: 'Link copied to clipboard',
        dismissible: true,
      })
    } catch (error) {
      pushToast({
        kind: 'error',
        text: 'Failed to copy link',
        dismissible: true,
      })
    }
  }

  function next(): void {
    pswp?.next()
  }

  function prev(): void {
    pswp?.prev()
  }

  function closeOverlay(): void {
    closeViewer()
    pswp?.close()
  }

  $: if ($viewerIndex !== null && !pswp) {
    attachPhotoSwipe()
  }

  $: if (pswp && $viewerIndex !== null && pswp.currIndex !== $viewerIndex) {
    pswp.goTo($viewerIndex)
  }

  $: if ($viewerIndex === null && pswp) {
    pswp.close()
  }

  $: if ($viewerIndex !== null && viewerUiElement) {
    setupSwipeGestures()
  } else {
    teardownSwipeGestures()
  }

  onDestroy(() => {
    pswpOpenToken += 1
    pswp?.destroy()
    teardownSwipeGestures()
  })

  let viewerUiElement: HTMLElement | null = null
  let swipeGesturesManager: { destroy: () => void } | null = null

  function setupSwipeGestures(): void {
    if (!viewerUiElement) return
    
    // Clean up previous swipe gestures
    swipeGesturesManager?.destroy()
    
    // Set up new swipe gestures for gallery navigation
    swipeGesturesManager = createGallerySwipeGestures(viewerUiElement, {
      onNext: () => next(),
      onPrevious: () => prev(),
      onClose: () => closeOverlay()
    })
  }

  function teardownSwipeGestures(): void {
    swipeGesturesManager?.destroy()
    swipeGesturesManager = null
  }
</script>

 {#if $viewerIndex !== null}
  <div class="viewer-ui" bind:this={viewerUiElement}>
    <div class="topbar">
      <button class="button ghost" type="button" on:click={closeOverlay}>✕</button>
      <button class="button ghost" type="button" on:click={downloadCurrent} title={$isOffline ? 'Downloads are unavailable offline unless the file is already open in the viewer cache.' : 'Download'} disabled={$isOffline}>⬇</button>
      {#if $activeItem && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'}
        <button class="button ghost" type="button" on:click={shareCurrent} title={$isOffline ? 'Sharing is unavailable offline because uncached media cannot be fetched.' : 'Share'} disabled={$isOffline || $activeItem.size > shareLimitBytes}>↑</button>
      {/if}
      {#if $activeItem && isImageItem($activeItem) && typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined'}
        <button class="button ghost" type="button" on:click={copyCurrent} title="Copy image" disabled={$isOffline}>⧉</button>
      {/if}
      {#if $activeItem && typeof navigator.clipboard?.writeText === 'function'}
        <button class="button ghost" type="button" on:click={copyLink} title="Copy link to this media" disabled={$isOffline}>🔗</button>
      {/if}
      <button class="button ghost" class:info-active={showInfo} type="button" on:click={() => (showInfo = !showInfo)} title="Toggle info panel — shows filename, size, date, sender" aria-label="Toggle info panel">ⓘ Info</button>
    </div>

    <button class="nav left" type="button" on:click={prev} aria-label="Previous media">←</button>
    <button class="nav right" type="button" on:click={next} aria-label="Next media">→</button>

    {#if $activeItem}
      <div class="caption">{$viewerIndex + 1} / {($viewerItems.length || $mediaItems.length)} - {mediaKindLabel($activeItem)} - {formatSize($activeItem.size)} - {loadProgress}%</div>
      <InfoPanel item={$activeItem} open={showInfo} />
    {/if}
  </div>
{/if}

<style>
  .viewer-ui {
    position: fixed;
    inset: 0;
    z-index: 100001;
    pointer-events: none;
  }

  .topbar,
  .nav,
  .caption,
  :global(.info-panel) {
    pointer-events: auto;
  }

  .topbar {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 16px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: rgba(12, 12, 12, 0.58);
    backdrop-filter: blur(20px);
  }

  .nav {
    position: fixed;
    top: 50%;
    width: 52px;
    height: 52px;
    margin-top: -26px;
    border: 0;
    color: white;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
  }

  .nav.left {
    left: 16px;
  }

  .nav.right {
    right: 16px;
  }

  .caption {
    position: fixed;
    right: 24px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
    color: var(--text-secondary);
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.45);
  }

  :global(.viewer-fallback),
  :global(.viewer-video-wrap),
  :global(.viewer-audio-wrap),
  :global(.viewer-text-wrap),
  :global(.viewer-pdf-wrap) {
    box-sizing: border-box;
    width: min(720px, calc(100vw - 48px));
    max-height: min(80vh, 720px);
    min-height: 180px;
    display: grid;
    gap: 16px;
    padding: 24px;
    color: white;
    border-radius: 20px;
    background: rgba(20, 20, 20, 0.92);
  }

  :global(.viewer-video-wrap) {
    width: min(960px, calc(100vw - 48px));
    height: min(80vh, calc(100dvh - 160px));
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    padding: 0;
  }

  :global(.viewer-audio-wrap),
  :global(.viewer-text-wrap),
  :global(.viewer-fallback),
  :global(.viewer-pdf-wrap) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
  }

  :global(.viewer-video) {
    display: block;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 160px);
    max-height: calc(100dvh - 160px);
    width: auto;
    height: auto;
    object-fit: contain;
  }

  :global(.viewer-text-wrap) {
    overflow: hidden;
  }

  :global(.viewer-text-wrap pre) {
    margin: 0;
    width: 100%;
    flex: 1;
    max-height: min(80vh, calc(100dvh - 160px));
    overflow: auto;
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  :global(.viewer-audio) {
    display: block;
    width: 100%;
    max-width: 640px;
    align-self: center;
  }

  :global(.viewer-audio-title) {
    width: 100%;
    max-width: 640px;
    align-self: center;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.viewer-fallback h3),
  :global(.viewer-audio-title),
  :global(.viewer-text-wrap pre) {
    color: var(--text-primary);
  }

  :global(.viewer-offline) {
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 12px;
  }

  :global(.viewer-offline-icon) {
    font-size: 3rem;
  }

  :global(.viewer-fallback h3),
  :global(.viewer-audio-wrap h3) {
    margin: 0;
  }

  :global(.viewer-fallback p) {
    margin: 0;
    color: rgba(255, 255, 255, 0.72);
  }

  :global(.viewer-pdf-wrap) {
    width: min(960px, calc(100vw - 48px));
    height: min(80vh, 960px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    padding: 0;
  }

  :global(.viewer-pdf) {
    width: min(960px, calc(100vw - 48px));
    height: min(80vh, 960px);
    border: 0;
    border-radius: 18px;
    background: white;
  }

  @media (max-width: 720px) {
    .topbar {
      top: calc(env(safe-area-inset-top, 0px) + 12px);
    }

    .nav {
      display: none;
    }

    .caption {
      left: 16px;
      right: 16px;
      text-align: center;
    }

    :global(.viewer-fallback),
    :global(.viewer-video-wrap),
    :global(.viewer-audio-wrap),
    :global(.viewer-text-wrap),
    :global(.viewer-pdf-wrap),
    :global(.viewer-pdf) {
      width: calc(100vw - 24px);
    }

    :global(.viewer-video) {
      max-width: calc(100vw - 24px);
      max-height: calc(100dvh - 148px);
    }
  }
</style>
