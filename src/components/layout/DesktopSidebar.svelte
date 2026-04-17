<script lang="ts">
  import { currentDialog, mediaItems, selectedFilter } from '../../stores/gallery'
  import { galleryFilters, mediaTypeToFilter } from '../../lib/media'
  import type { MediaItem } from '../../types/telegram'
  
  export let currentMediaItem: MediaItem | null = null
  
  $: dialog = $currentDialog
  $: totalItems = $mediaItems.length
  $: filteredItems = $mediaItems.filter(item => {
    if ($selectedFilter === 'all') return true
    return mediaTypeToFilter(item.type) === $selectedFilter
  })
  
  $: mediaTypeCounts = calculateMediaTypeCounts($mediaItems)
  
  function calculateMediaTypeCounts(items: MediaItem[]): Record<string, number> {
    const counts: Record<string, number> = {}
    
    items.forEach(item => {
      const filter = mediaTypeToFilter(item.type)
      counts[filter] = (counts[filter] || 0) + 1
    })
    
    return counts
  }
  
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  function formatDuration(seconds: number | null): string {
    if (!seconds) return 'N/A'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
</script>

{#if dialog}
  <aside class="desktop-sidebar-panel">
    <h3>Dialog Information</h3>
    
    <div class="metadata-item">
      <div class="metadata-label">Title</div>
      <div class="metadata-value">{dialog.title}</div>
    </div>
    
    {#if dialog.subtitle}
      <div class="metadata-item">
        <div class="metadata-label">Subtitle</div>
        <div class="metadata-value">{dialog.subtitle}</div>
      </div>
    {/if}
    
    {#if dialog.username}
      <div class="metadata-item">
        <div class="metadata-label">Username</div>
        <div class="metadata-value">@{dialog.username}</div>
      </div>
    {/if}
    
    <div class="metadata-item">
      <div class="metadata-label">Media Statistics</div>
      <div class="metadata-value">
        {totalItems} total items
        {#if $selectedFilter !== 'all'}
          <br>({filteredItems.length} filtered)
        {/if}
      </div>
    </div>
    
    <div class="metadata-item">
      <div class="metadata-label">Media Types</div>
      <div class="metadata-value">
        {#each galleryFilters.filter(f => f.id !== 'all') as filter}
          {#if mediaTypeCounts[filter.id] > 0}
            <div>{filter.label}: {mediaTypeCounts[filter.id]}</div>
          {/if}
        {/each}
      </div>
    </div>
    
    {#if currentMediaItem}
      <h3 style="margin-top: 24px;">Selected Media</h3>
      
      <div class="metadata-item">
        <div class="metadata-label">Filename</div>
        <div class="metadata-value">{currentMediaItem.filename}</div>
      </div>
      
      <div class="metadata-item">
        <div class="metadata-label">Type</div>
        <div class="metadata-value">{currentMediaItem.type}</div>
      </div>
      
      {#if currentMediaItem.width && currentMediaItem.height}
        <div class="metadata-item">
          <div class="metadata-label">Dimensions</div>
          <div class="metadata-value">{currentMediaItem.width} × {currentMediaItem.height}</div>
        </div>
      {/if}
      
      {#if currentMediaItem.size}
        <div class="metadata-item">
          <div class="metadata-label">Size</div>
          <div class="metadata-value">{formatFileSize(currentMediaItem.size)}</div>
        </div>
      {/if}
      
      {#if currentMediaItem.durationSeconds}
        <div class="metadata-item">
          <div class="metadata-label">Duration</div>
          <div class="metadata-value">{formatDuration(currentMediaItem.durationSeconds)}</div>
        </div>
      {/if}
      
      {#if currentMediaItem.date}
        <div class="metadata-item">
          <div class="metadata-label">Date</div>
          <div class="metadata-value">{new Date(currentMediaItem.date * 1000).toLocaleString()}</div>
        </div>
      {/if}
      
      {#if currentMediaItem.sender}
        <div class="metadata-item">
          <div class="metadata-label">Sender</div>
          <div class="metadata-value">{currentMediaItem.sender}</div>
        </div>
      {/if}
      
      {#if currentMediaItem.caption}
        <div class="metadata-item">
          <div class="metadata-label">Caption</div>
          <div class="metadata-value" style="font-style: italic;">"{currentMediaItem.caption}"</div>
        </div>
      {/if}
    {:else}
      <div class="metadata-item">
        <div class="metadata-label">Selected Media</div>
        <div class="metadata-value">Click on a media item to see details</div>
      </div>
    {/if}
    
    <div class="metadata-item" style="border-bottom: none; padding-bottom: 0;">
      <div class="metadata-label">Quick Actions</div>
      <div class="metadata-value">
        <button class="button secondary small" on:click={() => window.location.reload()}>
          Refresh Gallery
        </button>
      </div>
    </div>
  </aside>
{/if}

<style>
  .desktop-sidebar-panel {
    position: sticky;
    top: 80px;
    background: var(--bg-surface);
    border-radius: var(--radius-md);
    padding: 20px;
    border: 1px solid var(--border);
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 1.1rem;
  }
  
  .metadata-item {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  
  .metadata-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  
  .metadata-value {
    font-size: 1rem;
    color: var(--text-primary);
    line-height: 1.4;
  }
  
  .button.small {
    padding: 6px 12px;
    font-size: 0.85rem;
    margin-top: 8px;
  }
</style>