<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { getStorageUsage, formatBytes, getStorageQuota, type StorageUsage } from '../../lib/cache/storage-usage'
  
  let usage: StorageUsage | null = null
  let quotaInfo: { usage: number; quota: number; percentage: number } | null = null
  let loading = true
  let error: string | null = null
  let refreshInterval: number | null = null
  
  async function loadUsage(): Promise<void> {
    try {
      loading = true
      error = null
      
      const [usageData, quotaData] = await Promise.all([
        getStorageUsage(),
        getStorageQuota()
      ])
      
      usage = usageData
      quotaInfo = quotaData
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load storage usage'
      usage = null
      quotaInfo = null
    } finally {
      loading = false
    }
  }
  
  function refresh(): void {
    void loadUsage()
  }
  
  onMount(() => {
    void loadUsage()
    
    // Refresh every 30 seconds
    refreshInterval = window.setInterval(refresh, 30000)
  })
  
  onDestroy(() => {
    if (refreshInterval !== null) {
      clearInterval(refreshInterval)
    }
  })
</script>

<div class="cache-indicator" role="status" aria-label="Cache storage usage">
  {#if loading}
    <div class="cache-loading muted">Loading cache info...</div>
  {:else if error}
    <div class="cache-error muted" title={error}>⚠ Cache info unavailable</div>
  {:else if usage}
    <div class="cache-details">
      <div class="cache-summary">
        <span class="cache-label">Cache:</span>
        <span class="cache-value">{formatBytes(usage.totalBytes)}</span>
        <span class="cache-count">({usage.totalCount} items)</span>
      </div>
      
      {#if quotaInfo}
        <div class="cache-quota">
          <div class="quota-bar">
            <div 
              class="quota-fill" 
              style={`width: ${Math.min(quotaInfo.percentage, 100)}%`}
              role="progressbar"
              aria-valuenow={quotaInfo.percentage}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Storage quota usage"
            ></div>
          </div>
          <div class="quota-text muted">
            {formatBytes(quotaInfo.usage)} / {formatBytes(quotaInfo.quota)} ({Math.round(quotaInfo.percentage)}%)
          </div>
        </div>
      {/if}
      
      <div class="cache-breakdown muted">
        {#if usage.opfsAvailable}
          Thumbnails: {formatBytes(usage.thumbnailsBytes)} ({usage.thumbnailsCount})
          • Full media: {formatBytes(usage.opfsBytes || 0)} ({usage.opfsCount || 0})
        {:else}
          Thumbnails: {formatBytes(usage.thumbnailsBytes)} ({usage.thumbnailsCount})
          • Full media: OPFS not available
        {/if}
      </div>
    </div>
  {/if}
  
  <button 
    class="cache-refresh button ghost" 
    type="button" 
    on:click={refresh}
    aria-label="Refresh cache information"
    title="Refresh cache information"
    disabled={loading}
  >
    {#if loading}
      ↻
    {:else}
      ↻
    {/if}
  </button>
</div>

<style>
  .cache-indicator {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.02);
    font-size: 0.9rem;
    max-width: 400px;
  }
  
  .cache-details {
    flex: 1;
    min-width: 0;
  }
  
  .cache-summary {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 6px;
  }
  
  .cache-label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .cache-value {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .cache-count {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  
  .cache-quota {
    margin-bottom: 4px;
  }
  
  .quota-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  
  .quota-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
    transition: width 0.3s ease;
  }
  
  .quota-text {
    font-size: 0.8rem;
    text-align: right;
  }
  
  .cache-breakdown {
    font-size: 0.8rem;
    line-height: 1.3;
  }
  
  .cache-loading,
  .cache-error {
    flex: 1;
    font-size: 0.9rem;
    padding: 4px 0;
  }
  
  .cache-refresh {
    padding: 6px;
    min-width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .cache-refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .cache-indicator {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    
    .cache-refresh {
      align-self: flex-end;
    }
  }
  
  @media (max-width: 480px) {
    .cache-breakdown {
      font-size: 0.75rem;
    }
    
    .cache-summary {
      flex-wrap: wrap;
    }
  }
</style>