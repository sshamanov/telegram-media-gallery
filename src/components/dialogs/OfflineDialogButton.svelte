<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { markDialogForOffline, getPrefetchStatus, cancelPrefetch } from '../../lib/cache/prefetch'
  import { pushToast, isOffline } from '../../stores/ui'
  import { get } from 'svelte/store'
  import type { Dialog } from '../../types/telegram'

  export let dialog: Dialog

  let prefetchStatus: 'none' | 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled' = 'none'
  let progress = 0
  let totalItems = 0
  let processedItems = 0
  let error: string | null = null

  let checkInterval: number | null = null

  async function updateStatus() {
    const status = await getPrefetchStatus(dialog.id)
    if (!status) {
      prefetchStatus = 'none'
      progress = 0
      totalItems = 0
      processedItems = 0
      error = null
      return
    }

    prefetchStatus = status.status
    totalItems = status.totalItems
    processedItems = status.processedItems
    error = status.error
    
    if (totalItems > 0) {
      progress = Math.round((processedItems / totalItems) * 100)
    } else {
      progress = 0
    }
  }

  async function handleClick() {
    if (get(isOffline)) {
      pushToast({ kind: 'error', text: 'Cannot download for offline while offline', dismissible: true })
      return
    }

    if (prefetchStatus === 'none') {
      try {
        await markDialogForOffline(dialog.id)
        pushToast({ kind: 'info', text: `Started downloading "${dialog.title}" for offline`, dismissible: true })
        updateStatus()
      } catch (err) {
        pushToast({ kind: 'error', text: `Failed to start download: ${err}`, dismissible: true })
      }
    } else if (prefetchStatus === 'downloading' || prefetchStatus === 'pending') {
      try {
        await cancelPrefetch(dialog.id)
        pushToast({ kind: 'info', text: `Cancelled download for "${dialog.title}"`, dismissible: true })
        updateStatus()
      } catch (err) {
        pushToast({ kind: 'error', text: `Failed to cancel download: ${err}`, dismissible: true })
      }
    }
  }

  onMount(() => {
    updateStatus()
    // Check status every 2 seconds for updates
    checkInterval = window.setInterval(updateStatus, 2000)
  })

  onDestroy(() => {
    if (checkInterval) {
      window.clearInterval(checkInterval)
    }
  })
</script>

<button
  class="offline-dialog-button"
  on:click={handleClick}
  title={
    prefetchStatus === 'none'
      ? 'Download this dialog for offline access'
      : prefetchStatus === 'pending'
      ? 'Waiting to start download...'
      : prefetchStatus === 'downloading'
      ? `Downloading ${processedItems}/${totalItems} items (${progress}%)`
      : prefetchStatus === 'completed'
      ? 'Available offline'
      : prefetchStatus === 'failed'
      ? `Download failed: ${error}`
      : 'Download cancelled'
  }
  disabled={get(isOffline)}
>
  {#if prefetchStatus === 'none'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
    Download
  {:else if prefetchStatus === 'pending'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
    Queued
  {:else if prefetchStatus === 'downloading'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
    {progress}%
  {:else if prefetchStatus === 'completed'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
    Offline
  {:else if prefetchStatus === 'failed'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    Failed
  {:else}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
    Cancelled
  {/if}
</button>

<style>
  .offline-dialog-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-color);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .offline-dialog-button:hover:not(:disabled) {
    background: var(--bg-tertiary);
    border-color: var(--accent-color);
  }

  .offline-dialog-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .offline-dialog-button svg {
    flex-shrink: 0;
  }
</style>