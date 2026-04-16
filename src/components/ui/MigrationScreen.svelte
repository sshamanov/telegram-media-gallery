<script lang="ts">
  export let progress: number = 0
  export let processedEntries: number = 0
  export let totalEntries: number = 0
</script>

<div class="migration-overlay" data-testid="migration-screen">
  <div class="migration-card panel">
    <h2>Upgrading storage...</h2>
    <p class="muted">Moving cached full media from IndexedDB into OPFS.</p>
    <div class="migration-bar">
      <span style="width: {progress}%"></span>
    </div>
    <p class="migration-pct muted">{progress}%</p>
    <p class="migration-note muted">
      {#if totalEntries > 0}
        {processedEntries} of {totalEntries} items processed
      {:else}
        Preparing migration
      {/if}
    </p>
  </div>
</div>

<style>
  .migration-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-base);
    z-index: 100;
  }

  .migration-card {
    width: min(420px, 90vw);
    display: grid;
    gap: 16px;
    padding: 32px;
    text-align: center;
  }

  h2 {
    margin: 0;
  }

  p {
    margin: 0;
  }

  .migration-bar {
    height: 12px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .migration-bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
    transition: width 0.2s ease;
  }

  .migration-pct {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .migration-note {
    font-size: 0.85rem;
  }
</style>
