<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { formatDuration, hasThumbnail, mediaGlyph } from '../../lib/media'
  import { loadThumbnailBlob } from '../../lib/thumbnails'
  import type { MediaItem as GalleryMediaItem } from '../../types/telegram'

  export let item: GalleryMediaItem
  export let selected = false
  export let selectionMode = false
  export let onActivate: (itemId: string, event: MouseEvent) => void
  export let onLongPress: (itemId: string) => void

  let element: HTMLButtonElement | null = null
  let thumbUrl: string | null = null
  let observer: IntersectionObserver | null = null
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let longPressTriggered = false
  let thumbLoadToken = 0

  function showVideoBadge(value: GalleryMediaItem): boolean {
    return ['video', 'document-video', 'large-video'].includes(value.type)
  }

  function showAudioBadge(value: GalleryMediaItem): boolean {
    return ['document-audio'].includes(value.type)
  }

  function showFileBadge(value: GalleryMediaItem): boolean {
    return ['document-pdf', 'document-text', 'document-other', 'large-file'].includes(value.type)
  }

  function audioDurationLabel(value: GalleryMediaItem): string {
    return formatDuration(value.media.durationSeconds ?? null)
  }

  function setThumbUrl(nextUrl: string | null): void {
    if (thumbUrl) {
      URL.revokeObjectURL(thumbUrl)
    }
    thumbUrl = nextUrl
  }

  async function loadThumb(): Promise<void> {
    if (!hasThumbnail(item)) {
      return
    }

    const loadToken = ++thumbLoadToken
    const thumbnailBlob = await loadThumbnailBlob(item)
    if (thumbnailBlob && loadToken === thumbLoadToken) {
      setThumbUrl(URL.createObjectURL(thumbnailBlob))
      return
    }
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
    thumbLoadToken += 1
    observer?.disconnect()
    clearLongPress()
    setThumbUrl(null)
  })
</script>

<button
  bind:this={element}
  class:selected
  class:selection-mode={selectionMode}
  class="media-card"
  type="button"
  data-testid="media-item"
  data-media-id={item.id}
  on:click={handleClick}
  on:pointercancel={clearLongPress}
  on:pointerdown={handlePointerDown}
  on:pointermove={clearLongPress}
  on:pointerup={clearLongPress}
>
  {#if thumbUrl}
    <img src={thumbUrl} alt={item.filename} loading="lazy" />
  {:else}
    <div class="fallback">
      <span class="glyph">{mediaGlyph(item)}</span>
      <span class="fallback-name">{item.filename}</span>
    </div>
  {/if}

  {#if showVideoBadge(item)}
    <span class="badge">▶</span>
  {:else if showAudioBadge(item)}
    <span class="badge wide">{audioDurationLabel(item)}</span>
  {:else if showFileBadge(item)}
    <span class="badge wide">{mediaGlyph(item)}</span>
  {/if}

  <div class="meta-strip">
    <span class="meta-name">{item.filename}</span>
  </div>

  {#if selectionMode}
    <div class="selection-mark">{selected ? '✓' : ''}</div>
  {/if}
</button>

<style>
  .media-card {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border: 0;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
  }

  .media-card.selection-mode::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 136, 204, 0.08);
  }

  .media-card.selected::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 136, 204, 0.26);
    box-shadow: inset 0 0 0 2px rgba(0, 136, 204, 0.9);
  }

  /* Keyboard focus indicator */
  .media-card:focus-visible {
    outline: 3px solid var(--border-focus);
    outline-offset: 2px;
    z-index: 1;
  }

  img,
  .fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fallback {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 8px;
    padding: 12px;
    color: var(--text-secondary);
    background: linear-gradient(180deg, rgba(0, 136, 204, 0.12), rgba(255, 255, 255, 0.02));
  }

  .glyph {
    font-size: 0.82rem;
    letter-spacing: 0.12em;
    font-weight: 700;
  }

  .fallback-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
  }

  .badge {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
  }

  .badge.wide {
    width: auto;
    min-width: 44px;
    padding: 0 10px;
    font-size: 0.72rem;
  }

  .meta-strip {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 24px 10px 10px;
    background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.82));
  }

  .meta-name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    font-size: 0.78rem;
  }

  .selection-mark {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(0, 0, 0, 0.42);
    font-weight: 700;
  }
</style>
