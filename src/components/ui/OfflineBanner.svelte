<script lang="ts">
  import { isOffline } from '../../stores/ui'
  import { hasDialogSnapshot } from '../../stores/dialogs'

  $: bannerMode = $hasDialogSnapshot ? 'cached' : 'empty'
</script>

{#if $isOffline}
  <div class="offline-banner" data-testid="offline-banner" data-offline-mode={bannerMode}>
    {#if bannerMode === 'cached'}
      ⚠ Offline - showing last synced data
    {:else}
      ⚠ Offline - reconnect to load Telegram data
    {/if}
  </div>
{/if}

<style>
  .offline-banner {
    position: sticky;
    top: 0;
    z-index: 90;
    padding: 10px 16px;
    color: #201400;
    text-align: center;
    background: var(--color-warning);
  }
</style>
