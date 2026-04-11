<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { getCachedOrDownloadBlob } from '../../lib/files'
  import { formatShortDate, formatSize, hasThumbnail, isImageItem, isVideoItem, mediaGlyph } from '../../lib/media'
  import { createImageThumbnail, createVideoThumbnail } from '../../lib/thumbnails'
  import type { MediaItem } from '../../types/telegram'

  export let item: MediaItem
  export let selected = false
  export let selectionMode = false
  export let onActivate: (itemId: string, event: MouseEvent) => void
  export let onLongPress: (itemId: string) => void

  let element: HTMLButtonElement | null = null
  let thumbUrl: string | null = null
  let observer: IntersectionObserver | null = null
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let longPressTriggered = false

  async function loadThumb(): Promise<void> {
    if (!hasThumbnail(item)) {
      return
    }

    const cached = await getCachedOrDownloadBlob(item, 'thumb')
    if (cached) {
      thumbUrl = URL.createObjectURL(cached)
      return
    }

    if (!isImageItem(item) && !isVideoItem(item)) {
      return
    }

    const fullBlob = await getCachedOrDownloadBlob(item, 'full')
    if (!fullBlob) {
      return
    }

    const generated = isImageItem(item)
      ? await createImageThumbnail(fullBlob)
      : await createVideoThumbnail(fullBlob)

    if (!generated) {
      return
    }
    thumbUrl = URL.createObjectURL(generated)
  }

  function clearLongPress(): void {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      return
    }

    longPressTriggered = false
    clearLongPress()
    longPressTimer = setTimeout(() => {
      longPressTriggered = true
      onLongPress(item.id)
    }, 500)
  }

  function handleClick(event: MouseEvent): void {
    if (longPressTriggered) {
      longPressTriggered = false
      return
    }

    onActivate(item.id, event)
  }

  onMount(() => {
    if (!element) {
      return
    }

    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadThumb()
        observer?.disconnect()
        observer = null
      }
    }, { rootMargin: '200px' })

    observer.observe(element)
  })

  onDestroy(() => {
    observer?.disconnect()
    clearLongPress()
    if (thumbUrl) {
      URL.revokeObjectURL(thumbUrl)
    }
  })
</script>

<button
  bind:this={element}
  class:selected
  class:selection-mode={selectionMode}
  class="list-row panel"
  type="button"
  on:click={handleClick}
  on:pointercancel={clearLongPress}
  on:pointerdown={handlePointerDown}
  on:pointermove={clearLongPress}
  on:pointerup={clearLongPress}
>
  <div class="thumb">
    {#if thumbUrl}
      <img src={thumbUrl} alt={item.filename} loading="lazy" />
    {:else}
      <div class="fallback">{mediaGlyph(item)}</div>
    {/if}
  </div>

  <div class="copy">
    <div class="name">{item.filename}</div>
    <div class="meta muted">{formatShortDate(item.date)}</div>
  </div>

  <div class="size muted">{formatSize(item.size)}</div>

  {#if selectionMode}
    <div class="selection-mark">{selected ? '✓' : ''}</div>
  {/if}
</button>

<style>
  .list-row {
    position: relative;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 12px 14px;
    border: 0;
    text-align: left;
  }

  .list-row.selection-mode {
    border-color: rgba(0, 136, 204, 0.22);
  }

  .list-row.selected {
    border-color: rgba(0, 136, 204, 0.65);
    background: rgba(0, 136, 204, 0.14);
  }

  .thumb,
  img,
  .fallback {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }

  img {
    object-fit: cover;
  }

  .fallback {
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
    font-size: 0.74rem;
    letter-spacing: 0.08em;
  }

  .name,
  .size {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name {
    font-weight: 600;
  }

  .meta {
    margin-top: 4px;
    font-size: 0.86rem;
  }

  .size {
    font-size: 0.88rem;
  }

  .selection-mark {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.42);
    border: 1px solid rgba(255, 255, 255, 0.28);
    font-size: 0.82rem;
    font-weight: 700;
  }

  @media (max-width: 640px) {
    .list-row {
      grid-template-columns: 48px minmax(0, 1fr);
    }

    .size {
      grid-column: 2;
    }
  }
</style>
