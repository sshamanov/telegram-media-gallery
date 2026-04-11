<script lang="ts">
  import { isOffline } from '../../stores/ui'
</script>

{#if $isOffline}
  <div class="offline-banner">⚠ Offline - showing cached content</div>
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
