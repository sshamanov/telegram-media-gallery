<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { getAllPrefetches, type PrefetchQueueItem } from '../../lib/cache/indexeddb'
  import { cancelPrefetch } from '../../lib/cache/prefetch'
  import { pushToast, isOffline } from '../../stores/ui'
  import { get } from 'svelte/store'

  let prefetches: PrefetchQueueItem[] = []
  let loading = false
  let checkInterval: number | null = null

  async function loadPrefetches() {
    loading = true
    try {
      prefetches = await getAllPrefetches()
    } catch (error) {
      pushToast({ kind: 'error', text: `Failed to load offline dialogs: ${error}`, dismissible: true })
    } finally {
      loading = false
    }
  }

  async function handleCancel(dialogId: string) {
    if (get(isOffline)) {
      pushToast({ kind: 'error', text: 'Cannot cancel downloads while offline', dismissible: true })
      return
    }

    try {
      await cancelPrefetch(dialogId)
      pushToast({ kind: 'info', text: 'Download cancelled', dismissible: true })
      await loadPrefetches()
    } catch (error) {
      pushToast({ kind: 'error', text: `Failed to cancel download: ${error}`, dismissible: true })
    }
  }

  function formatProgress(prefetch: PrefetchQueueItem): string {
    if (prefetch.totalItems === 0) return '0%'
    const percent = Math.round((prefetch.processedItems / prefetch.totalItems) * 100)
    return `${percent}% (${prefetch.processedItems}/${prefetch.totalItems})`
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getStatusIcon(status: PrefetchQueueItem['status']): string {
    switch (status) {
      case 'pending': return '⏳'
      case 'downloading': return '⬇️'
      case 'completed': return '✅'
      case 'failed': return '❌'
      case 'cancelled': return '🚫'
      default: return '❓'
    }
  }

  function getStatusText(status: PrefetchQueueItem['status']): string {
    switch (status) {
      case 'pending': return 'Queued'
      case 'downloading': return 'Downloading'
      case 'completed': return 'Completed'
      case 'failed': return 'Failed'
      case 'cancelled': return 'Cancelled'
      default: return 'Unknown'
    }
  }

  onMount(() => {
    loadPrefetches()
    // Refresh every 5 seconds
    checkInterval = window.setInterval(loadPrefetches, 5000)
  })

  onDestroy(() => {
    if (checkInterval) {
      window.clearInterval(checkInterval)
    }
  })
</script>

<div class="offline-dialogs-section">
  <h3>Offline Dialogs</h3>
  
  {#if loading && prefetches.length === 0}
    <p class="muted">Loading...</p>
  {:else if prefetches.length === 0}
    <p class="muted">No dialogs marked for offline access.</p>
  {:else}
    <div class="prefetch-list">
      {#each prefetches as prefetch (prefetch.dialogId)}
        <div class="prefetch-item">
          <div class="prefetch-header">
            <span class="prefetch-dialog">{prefetch.dialogId}</span>
            <span class="prefetch-status {prefetch.status}">
              {getStatusIcon(prefetch.status)} {getStatusText(prefetch.status)}
            </span>
          </div>
          
          <div class="prefetch-details">
            {#if prefetch.status === 'downloading' || prefetch.status === 'completed'}
              <div class="prefetch-progress">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    style={`width: ${prefetch.totalItems > 0 ? (prefetch.processedItems / prefetch.totalItems) * 100 : 0}%`}
                  ></div>
                </div>
                <span class="progress-text">{formatProgress(prefetch)}</span>
              </div>
            {/if}
            
            <div class="prefetch-meta">
              <span>Started: {formatDate(prefetch.startedAt)}</span>
              {#if prefetch.completedAt}
                <span>Completed: {formatDate(prefetch.completedAt)}</span>
              {/if}
              {#if prefetch.error}
                <span class="error">Error: {prefetch.error}</span>
              {/if}
            </div>
          </div>
          
          <div class="prefetch-actions">
            {#if prefetch.status === 'pending' || prefetch.status === 'downloading'}
              <button
                class="button danger small"
                on:click={() => handleCancel(prefetch.dialogId)}
                disabled={get(isOffline)}
                title={get(isOffline) ? 'Cannot cancel while offline' : 'Cancel download'}
              >
                Cancel
              </button>
            {:else if prefetch.status === 'completed' || prefetch.status === 'failed' || prefetch.status === 'cancelled'}
              <button
                class="button danger small"
                on:click={() => handleCancel(prefetch.dialogId)}
                disabled={get(isOffline)}
                title="Remove from list"
              >
                Remove
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .offline-dialogs-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
  }

  .offline-dialogs-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .prefetch-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .prefetch-item {
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
  }

  .prefetch-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .prefetch-dialog {
    font-weight: 600;
    font-family: monospace;
    font-size: 0.9rem;
  }

  .prefetch-status {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--bg-tertiary);
  }

  .prefetch-status.pending {
    color: var(--text-muted);
  }

  .prefetch-status.downloading {
    color: var(--accent-color);
  }

  .prefetch-status.completed {
    color: var(--success-color);
  }

  .prefetch-status.failed,
  .prefetch-status.cancelled {
    color: var(--error-color);
  }

  .prefetch-details {
    margin-bottom: 0.75rem;
  }

  .prefetch-progress {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .progress-bar {
    flex: 1;
    height: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.875rem;
    color: var(--text-muted);
    min-width: 6ch;
    text-align: right;
  }

  .prefetch-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .prefetch-meta .error {
    color: var(--error-color);
  }

  .prefetch-actions {
    display: flex;
    justify-content: flex-end;
  }

  .button.small {
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
  }

  .muted {
    color: var(--text-muted);
    font-style: italic;
  }
</style>