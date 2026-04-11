<script lang="ts">
  import { reconnectState, retryReconnect } from '../../stores/telegram'
</script>

{#if $reconnectState === 'reconnecting'}
  <div class="reconnect-banner reconnecting" role="status" aria-live="polite">
    <span class="reconnect-icon spin">⟳</span>
    Connection lost — reconnecting...
  </div>
{:else if $reconnectState === 'failed'}
  <div class="reconnect-banner failed" role="alert">
    <span>✗ Reconnection failed</span>
    <button class="button secondary compact" type="button" on:click={retryReconnect}>
      Try again
    </button>
  </div>
{/if}

<style>
  .reconnect-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .reconnecting {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border);
  }

  .failed {
    background: var(--accent-danger);
    color: #fff;
  }

  .reconnect-icon {
    display: inline-block;
  }

  .compact {
    padding: 6px 12px;
    font-size: 0.85rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
</style>
