<script lang="ts">
  import DialogItem from './DialogItem.svelte'
  import { allDialogs, dialogSearch, galleries, galleryIds, setDialogs, toggleGallery } from '../../stores/dialogs'
  import { authState, telegramAdapter } from '../../stores/telegram'
  import { setActiveDialog } from '../../stores/gallery'
  import { pushToast } from '../../stores/ui'
  import { tooltip } from '../../lib/dom/tooltips'
  import { navigateToSettings, navigateToGallery } from '../../lib/routing'
  import type { Dialog } from '../../types/telegram'

  let tab: 'galleries' | 'groups' | 'chats' = 'galleries'
  let currentTabCount = 0
  let filteredDialogs: Dialog[] = []

  $: {
    const query = $dialogSearch.trim().toLowerCase()
    const base: Dialog[] = tab === 'groups'
      ? $allDialogs.filter((dialog: Dialog) => dialog.kind === 'group')
      : tab === 'chats'
        ? $allDialogs.filter((dialog: Dialog) => dialog.kind === 'chat')
        : $allDialogs

    currentTabCount = tab === 'galleries' ? $galleries.length : base.length
    filteredDialogs = query
      ? base.filter((dialog: Dialog) => dialog.title.toLowerCase().includes(query))
      : base
  }

  function openDialog(dialog: Dialog): void {
    setActiveDialog(dialog)
    navigateToGallery(dialog.id)
  }

  async function refreshDialogs(): Promise<void> {
    try {
      const dialogs = await telegramAdapter.getDialogs()
      setDialogs(dialogs)
    } catch {
      pushToast({ kind: 'error', text: 'Failed to refresh dialogs', dismissible: true })
    }
  }

  function switchTab(nextTab: 'galleries' | 'groups' | 'chats'): void {
    tab = nextTab
    void refreshDialogs()
  }

  function openSettings(): void {
    navigateToSettings()
  }

  async function logout(): Promise<void> {
    await telegramAdapter.logout()
    localStorage.removeItem('session')
    authState.set('idle')
    pushToast({ kind: 'info', text: 'Session cleared', dismissible: true })
  }
</script>

<section class="panel dialogs-shell">
  <header class="header">
    <div>
      <h1>Telegram Gallery</h1>
      <p class="muted">Browse your galleries, groups, and chats.</p>
    </div>
    <div class="header-actions">
      <button class="button secondary" type="button" on:click={openSettings} aria-label="Settings" use:tooltip={{ text: 'Settings' }}>⚙</button>
      <button class="button danger" type="button" on:click={logout}>Logout</button>
    </div>
  </header>

  <div class="tabs">
    <button class:active={tab === 'galleries'} class="tab" type="button" on:click={() => switchTab('galleries')}>Galleries</button>
    <button class:active={tab === 'groups'} class="tab" type="button" on:click={() => switchTab('groups')}>Groups</button>
    <button class:active={tab === 'chats'} class="tab" type="button" on:click={() => switchTab('chats')}>Chats</button>
  </div>

  {#if currentTabCount > 20}
    <input class="search" bind:value={$dialogSearch} placeholder="Search dialogs..." />
  {/if}

  {#if tab === 'galleries'}
    <div class="list">
      {#if $galleries.length === 0}
        <div class="empty muted">No galleries yet. Add groups or chats to pin them here.</div>
      {:else}
        {#each $galleries as dialog (dialog.id)}
          <DialogItem dialog={dialog} isGallery={true} onToggle={toggleGallery} onOpen={openDialog} />
        {/each}
      {/if}
    </div>
  {:else}
    <div class="list">
      {#each filteredDialogs as dialog (dialog.id)}
        <DialogItem dialog={dialog} isGallery={$galleryIds.includes(dialog.id)} onToggle={toggleGallery} onOpen={openDialog} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .dialogs-shell {
    padding: 18px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    margin-bottom: 18px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  h1 {
    margin: 0 0 6px;
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tab {
    border: 0;
    color: var(--text-secondary);
    background: transparent;
    padding: 12px 14px;
    border-bottom: 2px solid transparent;
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .list {
    display: grid;
    gap: 10px;
    margin-top: 16px;
  }

  .empty {
    padding: 42px 18px;
    text-align: center;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
  }

  @media (max-width: 720px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
