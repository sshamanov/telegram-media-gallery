<script lang="ts">
  import { allDialogs } from '../../stores/dialogs'
  import { pushToast } from '../../stores/ui'
  import type { Dialog } from '../../types/telegram'

  export let open = false
  export let onClose: () => void = () => {}
  export let onForward: (dialogId: string, dialogTitle: string) => Promise<void> = async () => {}

  let searchQuery = ''
  let selectedDialog: Dialog | null = null
  let isForwarding = false

  $: filteredDialogs = $allDialogs.filter((dialog) =>
    dialog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dialog.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    false
  )

  function handleDialogSelect(dialog: Dialog): void {
    selectedDialog = dialog
  }

  async function handleConfirm(): Promise<void> {
    if (!selectedDialog) {
      return
    }

    isForwarding = true
    try {
      await onForward(selectedDialog.id, selectedDialog.title)
      onClose()
      pushToast({
        kind: 'success',
        text: `Messages forwarded to ${selectedDialog.title}`,
        dismissible: true,
      })
    } catch (error) {
      pushToast({
        kind: 'error',
        text: `Failed to forward messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dismissible: true,
      })
    } finally {
      isForwarding = false
    }
  }

  function handleCancel(): void {
    onClose()
  }
</script>

{#if open}
  <div class="dialog-picker-overlay" on:click={handleCancel}>
    <div class="dialog-picker-modal" on:click|stopPropagation>
      <div class="dialog-picker-header">
        <h3>Forward to</h3>
        <button class="button ghost small" type="button" on:click={handleCancel} aria-label="Close">×</button>
      </div>

      <div class="dialog-picker-search">
        <input
          type="text"
          placeholder="Search dialogs..."
          bind:value={searchQuery}
          class="search-input"
          data-testid="dialog-picker-search"
        />
      </div>

      <div class="dialog-picker-list">
        {#if filteredDialogs.length === 0}
          <div class="empty-state muted">No dialogs found</div>
        {:else}
          {#each filteredDialogs as dialog (dialog.id)}
            <button
              class="dialog-item {selectedDialog?.id === dialog.id ? 'selected' : ''}"
              type="button"
              on:click={() => handleDialogSelect(dialog)}
              data-testid={`dialog-picker-item-${dialog.id}`}
            >
              {#if dialog.avatarUrl}
                <img src={dialog.avatarUrl} alt="" class="avatar" />
              {:else}
                <div class="avatar-placeholder">{dialog.title.charAt(0)}</div>
              {/if}
              <div class="dialog-info">
                <div class="dialog-title">{dialog.title}</div>
                <div class="dialog-subtitle muted">{dialog.subtitle}</div>
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="dialog-picker-actions">
        <button
          class="button ghost"
          type="button"
          on:click={handleCancel}
          data-testid="dialog-picker-cancel"
        >
          Cancel
        </button>
        <button
          class="button primary"
          type="button"
          on:click={handleConfirm}
          disabled={!selectedDialog || isForwarding}
          data-testid="dialog-picker-confirm"
        >
          {isForwarding ? 'Forwarding...' : 'Forward'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-picker-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: grid;
    place-items: center;
    z-index: 1000;
    padding: 20px;
  }

  .dialog-picker-modal {
    background: var(--bg-primary);
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .dialog-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }

  .dialog-picker-header h3 {
    margin: 0;
    font-size: 1.2rem;
  }

  .dialog-picker-search {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .dialog-picker-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .dialog-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
  }

  .dialog-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .dialog-item.selected {
    background: rgba(0, 136, 204, 0.15);
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent);
    display: grid;
    place-items: center;
    font-weight: bold;
    color: white;
  }

  .dialog-info {
    flex: 1;
    min-width: 0;
  }

  .dialog-title {
    font-weight: 500;
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dialog-subtitle {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dialog-picker-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--border);
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
  }

  .button.small {
    padding: 6px 12px;
    font-size: 0.9rem;
  }
</style>