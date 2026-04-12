<script lang="ts">
  import { dismissToast, toasts } from '../../stores/ui'
</script>

<div class="toast-stack" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <article class={`toast ${toast.kind}`}>
      <span>{toast.text}</span>
      {#if toast.dismissible}
        <button class="close" type="button" on:click={() => dismissToast(toast.id)} aria-label="Dismiss notification">✕</button>
      {/if}
    </article>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    left: 50%;
    bottom: 16px;
    z-index: 100;
    display: grid;
    gap: 10px;
    width: min(560px, calc(100vw - 24px));
    transform: translateX(-50%);
  }

  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(30, 30, 30, 0.94);
    border-left: 4px solid var(--accent);
    border-radius: 14px;
    box-shadow: var(--shadow-lg);
  }

  .toast.success {
    border-left-color: var(--color-success);
  }

  .toast.error {
    border-left-color: var(--color-error);
  }

  .toast.warning {
    border-left-color: var(--color-warning);
  }

  .close {
    border: 0;
    color: var(--text-primary);
    background: transparent;
  }
</style>
