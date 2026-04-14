<script lang="ts">
  import type { Dialog } from '../../types/telegram'

  export let dialog: Dialog
  export let isGallery: boolean
  export let onToggle: (dialogId: string) => void
  export let onOpen: (dialog: Dialog) => void
</script>

<div class="dialog-item panel" role="button" tabindex="0" on:click={() => onOpen(dialog)} on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && onOpen(dialog)} data-dialog-id={dialog.id} data-testid="dialog-item">
  <div class="avatar-wrap">
    {#if dialog.avatarUrl}
      <img class="avatar image" src={dialog.avatarUrl} alt={dialog.title} loading="lazy" />
    {:else}
      <div class="avatar">{dialog.title.slice(0, 1).toUpperCase()}</div>
    {/if}
  </div>
  <div class="copy">
    <div class="title">{dialog.title}</div>
    <div class="meta muted">{dialog.subtitle}</div>
  </div>
  <button class={`button ${isGallery ? 'danger' : 'secondary'}`} type="button" on:click|stopPropagation={() => onToggle(dialog.id)} data-testid="dialog-toggle-button">
    {isGallery ? 'Remove' : 'Add'}
  </button>
</div>

<style>
  .dialog-item {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    cursor: pointer;
  }

  .avatar-wrap,
  .avatar {
    width: 40px;
    height: 40px;
  }

  .avatar {
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(0, 136, 204, 0.7), rgba(0, 136, 204, 0.15));
  }

  .avatar.image {
    object-fit: cover;
  }

  .title {
    font-weight: 600;
  }

  .meta {
    margin-top: 4px;
    font-size: 0.92rem;
  }
</style>
