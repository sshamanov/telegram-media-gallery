<script lang="ts">
   import { onDestroy, onMount } from 'svelte'
   import { hasThumbnail, mediaGlyph, displayNameForMedia } from '../../lib/media'
   import { loadThumbnailBlob } from '../../lib/thumbnails'
   import { getItemCacheStatusStore } from '../../lib/cache/cache-status'
   import type { MediaItem as GalleryMediaItem } from '../../types/telegram'
   import { settings } from '../../stores/settings'

   export let item: GalleryMediaItem
  export let selected = false
  export let selectionMode = false
  export let focused = false
  export let masonry = false
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
  $: aspectRatio = getAspectRatio(item, masonry)

  function getAspectRatio(mediaItem: GalleryMediaItem, useMasonry: boolean): string {
    if (!useMasonry) {
      return '1 / 1'
    }

    if (mediaItem.width > 0 && mediaItem.height > 0) {
      return `${mediaItem.width} / ${mediaItem.height}`
    }

    return '1 / 1'
  }
</script>

<button
  bind:this={element}
  class:selected
  class:selection-mode={selectionMode}
  class:focused={focused}
  class:long-pressing={isLongPressing}
  class="media-card"
  type="button"
  style:aspect-ratio={aspectRatio}
  data-testid="media-item"
  data-media-id={item.id}
  data-item-id={item.id}
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
       <span class="fallback-name">{displayNameForMedia(item)}</span>
    </div>
  {/if}

   {#if item.sender}
     <span class="badge author">{item.sender}</span>
   {/if}

   {#if showCacheBadge && cacheBadgeText}
     <span class="badge cache-badge {cacheBadgeClass}" title={cacheBadgeTitle}>
       {cacheBadgeText}
     </span>
   {/if}

   <div class="meta-strip">
      <span class="meta-name">{displayNameForMedia(item)}</span>
   </div>

  {#if selectionMode}
    <div class="selection-mark">{selected ? '✓' : ''}</div>
  {/if}
</button>

<style>
  .media-card {
    position: relative;
    overflow: hidden;
    border: 0;
    border-radius: 14px;
    background: var(--bg-white-translucent-weak);
  }

  .media-card.selection-mode::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--bg-accent-translucent);
  }

  .media-card.selected::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--bg-accent-translucent-medium);
    box-shadow: inset 0 0 0 2px var(--accent);
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
    background: linear-gradient(180deg, var(--bg-accent-translucent-medium), var(--bg-white-translucent-weak));
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
    background: var(--bg-black-translucent-medium);
    backdrop-filter: blur(8px);
  }



   .badge.author {
     right: auto;
     left: 10px;
     top: 10px;
     bottom: auto;
     width: auto;
     min-width: 44px;
     max-width: 120px;
     height: auto;
     padding: 4px 8px;
     font-size: 0.72rem;
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
   }
   
    .badge.cache-badge {
      right: 10px;
      top: 10px;
      bottom: auto;
      width: 28px;
      height: 28px;
      font-size: 0.8rem;
    }
    
    @media (max-width: 720px) {
      .badge.cache-badge {
        width: 44px;
        height: 44px;
        padding: 8px;
      }
    }
   
   .badge.cache-badge.cached {
     background: var(--bg-success-translucent);
     color: var(--color-success);
   }
   
   .badge.cache-badge.downloading {
     background: var(--bg-accent-translucent);
     color: var(--accent);
     animation: pulse 1.5s infinite;
   }
   
   .badge.cache-badge.partial {
     background: var(--bg-warning-translucent);
     color: var(--color-warning);
   }
   
   .badge.cache-badge.remote {
     background: var(--bg-muted-translucent);
     color: var(--text-muted);
   }
   
   .badge.cache-badge.unknown {
     background: var(--bg-black-translucent-medium);
     color: var(--text-secondary);
   }
   
   @keyframes pulse {
     0%, 100% { opacity: 1; }
     50% { opacity: 0.6; }
   }

  .meta-strip {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 24px 10px 10px;
    background: linear-gradient(180deg, transparent, var(--bg-black-translucent-strong));
  }

  .meta-name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    font-size: 0.78rem;
  }

   .media-card.focused {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  .media-card.long-pressing {
    transform: scale(0.95);
    transition: transform 0.1s ease;
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
     border: 1px solid var(--border-white-translucent-strong);
     background: var(--bg-black-translucent-weak);
     font-weight: 700;
   }
   
   @media (max-width: 720px) {
     .selection-mark {
       width: 44px;
       height: 44px;
       padding: 8px;
     }
   }
</style>
