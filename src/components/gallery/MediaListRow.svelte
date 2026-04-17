<script lang="ts">
   import { onDestroy, onMount } from 'svelte'
   import { formatShortDate, formatSize, hasThumbnail, mediaGlyph, displayNameForMedia } from '../../lib/media'
   import { loadThumbnailBlob } from '../../lib/thumbnails'
   import { getItemCacheStatusStore } from '../../lib/cache/cache-status'
   import type { MediaItem } from '../../types/telegram'
   import { settings } from '../../stores/settings'

   export let item: MediaItem
  export let selected = false
  export let selectionMode = false
  export let focused = false
  export let onActivate: (itemId: string, event: MouseEvent) => void
  export let onLongPress: (itemId: string) => void

    let element: HTMLButtonElement | null = null
   let thumbUrl: string | null = null
   let observer: IntersectionObserver | null = null
   let longPressTimer: ReturnType<typeof setTimeout> | null = null
   let longPressTriggered = false
   let thumbLoadToken = 0
   let isLongPressing = false
   
   // Cache status
   const cacheStatus = getItemCacheStatusStore(item.id)
   $: showCacheBadge = $settings.showCacheBadges ?? true
   $: cacheBadgeText = getCacheBadgeText($cacheStatus)
   $: cacheBadgeTitle = getCacheBadgeTitle($cacheStatus)
   $: cacheBadgeClass = getCacheBadgeClass($cacheStatus)

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
     isLongPressing = false
   }
   
   // Cache badge helpers
   function getCacheBadgeText(status: any): string {
     if (!status) return ''
     
     if (status.fullMedia === 'cached') return '✓'
     if (status.fullMedia === 'downloading') return '↓'
     if (status.thumbnail === 'cached' && status.fullMedia === 'remote') return '⏳'
     return ''
   }
   
   function getCacheBadgeTitle(status: any): string {
     if (!status) return 'Cache status unknown'
     
     if (status.fullMedia === 'cached') return 'Full media cached'
     if (status.fullMedia === 'downloading') return 'Downloading...'
     if (status.thumbnail === 'cached' && status.fullMedia === 'remote') return 'Thumbnail cached, full media remote'
     if (status.thumbnail === 'remote' && status.fullMedia === 'remote') return 'Remote only'
     return 'Cache status unknown'
   }
   
   function getCacheBadgeClass(status: any): string {
     if (!status) return 'cache-badge unknown'
     
     if (status.fullMedia === 'cached') return 'cache-badge cached'
     if (status.fullMedia === 'downloading') return 'cache-badge downloading'
     if (status.thumbnail === 'cached' && status.fullMedia === 'remote') return 'cache-badge partial'
     return 'cache-badge remote'
   }

   function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      return
    }

    longPressTriggered = false
    clearLongPress()
    isLongPressing = true
    
    longPressTimer = setTimeout(() => {
      longPressTriggered = true
      isLongPressing = false
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
  class:focused={focused}
  class:long-pressing={isLongPressing}
  class="list-row panel"
  type="button"
  data-testid="media-item"
  data-media-id={item.id}
  data-item-id={item.id}
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
    <div class="name">{displayNameForMedia(item)}</div>
    {#if item.sender}
      <div class="author muted">{item.sender}</div>
    {/if}
    <div class="meta muted">{formatShortDate(item.date)}</div>
  </div>

   <div class="size muted">{formatSize(item.size)}</div>

   {#if showCacheBadge && cacheBadgeText}
     <div class="cache-badge {cacheBadgeClass}" title={cacheBadgeTitle}>
       {cacheBadgeText}
     </div>
   {/if}

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
    border-color: var(--border-accent-translucent-weak);
  }

  .list-row.selected {
    border-color: var(--border-accent-translucent-strong);
    background: var(--bg-accent-translucent);
  }

  /* Keyboard focus indicator */
  .list-row:focus-visible {
    outline: 3px solid var(--border-focus);
    outline-offset: 2px;
    z-index: 1;
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
    background: var(--bg-white-translucent-medium);
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

  .author {
    margin-top: 2px;
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  .size {
    font-size: 0.88rem;
  }

   .list-row.focused {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  .list-row.long-pressing {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }

   .cache-badge {
     display: grid;
     place-items: center;
     width: 24px;
     height: 24px;
     border-radius: 999px;
     font-size: 0.8rem;
     margin-left: 8px;
   }
   
   .cache-badge.cached {
     background: var(--bg-success-translucent);
     color: var(--color-success);
   }
   
   .cache-badge.downloading {
     background: var(--bg-accent-translucent);
     color: var(--accent);
     animation: pulse 1.5s infinite;
   }
   
   .cache-badge.partial {
     background: var(--bg-warning-translucent);
     color: var(--color-warning);
   }
   
   .cache-badge.remote {
     background: var(--bg-muted-translucent);
     color: var(--text-muted);
   }
   
   .cache-badge.unknown {
     background: var(--bg-black-translucent-medium);
     color: var(--text-secondary);
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
     background: var(--bg-black-translucent-weak);
     border: 1px solid var(--border-white-translucent-strong);
     font-size: 0.82rem;
     font-weight: 700;
   }
   
   @keyframes pulse {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.6; }
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
