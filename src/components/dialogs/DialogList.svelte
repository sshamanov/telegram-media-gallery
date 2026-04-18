<script lang="ts">
  import DialogItem from './DialogItem.svelte'
  import {
    allDialogs,
    dialogDataSource,
    dialogSearch,
    dialogSnapshotUpdatedAt,
    galleries,
    galleryIds,
    resetDialogsState,
    setDialogs,
    clearDialogSnapshot,
    toggleGallery,
  } from '../../stores/dialogs'
  import { authState, getCurrentAdapter, session } from '../../stores/telegram'
  import { setActiveDialog } from '../../stores/gallery'
  import { isOffline, pushToast } from '../../stores/ui'
  import { tooltip } from '../../lib/dom/tooltips'
  import { navigateToSettings, navigateToGallery } from '../../lib/routing'
  import { clearDialogCache } from '../../lib/cache/indexeddb'
  import type { Dialog } from '../../types/telegram'

  let tab: 'galleries' | 'groups' | 'chats' = 'galleries'
  let currentTabCount = 0
  let filteredDialogs: Dialog[] = []
  const snapshotTimeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  $: snapshotLabel = $dialogSnapshotUpdatedAt
    ? snapshotTimeFormatter.format(new Date($dialogSnapshotUpdatedAt))
    : null

  $: offlineStatusText = $isOffline
    ? snapshotLabel
      ? `Offline - showing last synced dialogs from ${snapshotLabel}.`
      : 'Offline - no cached dialog snapshot is available yet.'
    : null

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

  async function loadDialogs(forceRefresh = false): Promise<void> {
    if ($isOffline) {
      return
    }

    try {
      const dialogs = await getCurrentAdapter().getDialogs(forceRefresh ? { forceRefresh: true } : undefined)
      setDialogs(dialogs)
    } catch {
      pushToast({ kind: 'error', text: 'Failed to load dialogs', dismissible: true })
    }
  }

  function switchTab(nextTab: 'galleries' | 'groups' | 'chats'): void {
    tab = nextTab
    void loadDialogs(false)  // cache‑first
  }

  function openSettings(): void {
    navigateToSettings()
  }

  async function logout(): Promise<void> {
    await getCurrentAdapter().logout()
    localStorage.removeItem('session')
    localStorage.removeItem('phone')
    clearDialogSnapshot()
    void clearDialogCache()
    resetDialogsState()
    authState.set('idle')
    session.set({ session: null })
    pushToast({ kind: 'info', text: 'Session cleared', dismissible: true })
  }
</script>

<section class="panel dialogs-shell" data-testid="dialog-list" data-dialog-source={$dialogDataSource}>
  <header class="header">
    <div>
      <h1>Telegram Gallery</h1>
      <p class="muted">Browse your galleries, groups, and chats.</p>
      {#if offlineStatusText}
        <p class="status-note" data-testid="dialogs-data-status">{offlineStatusText}</p>
      {/if}
    </div>
    <div class="header-actions">
      <button class="button secondary" type="button" on:click={openSettings} aria-label="Settings" use:tooltip={{ text: 'Settings' }}>⚙</button>
      <button class="button danger" type="button" on:click={logout}>Logout</button>
    </div>
  </header>

  <div class="tabs" role="tablist" aria-label="Dialog categories">
    <button
      class:active={tab === 'galleries'}
      class="tab"
      type="button"
      role="tab"
      aria-selected={tab === 'galleries'}
      aria-controls="galleries-tabpanel"
      id="galleries-tab"
      on:click={() => switchTab('galleries')}
      data-testid="galleries-tab"
    >
      Galleries
    </button>
    <button
      class:active={tab === 'groups'}
      class="tab"
      type="button"
      role="tab"
      aria-selected={tab === 'groups'}
      aria-controls="groups-tabpanel"
      id="groups-tab"
      on:click={() => switchTab('groups')}
      data-testid="groups-tab"
    >
      Groups
    </button>
    <button
      class:active={tab === 'chats'}
      class="tab"
      type="button"
      role="tab"
      aria-selected={tab === 'chats'}
      aria-controls="chats-tabpanel"
      id="chats-tab"
      on:click={() => switchTab('chats')}
      data-testid="chats-tab"
    >
      Chats
    </button>
  </div>

  {#if currentTabCount > 20}
    <input class="search" bind:value={$dialogSearch} placeholder="Search dialogs..." data-testid="dialog-search" />
  {/if}

  {#if tab === 'galleries'}
    <div class="list" role="tabpanel" id="galleries-tabpanel" aria-labelledby="galleries-tab" tabindex="0" data-testid="galleries-list">
      {#if $galleries.length === 0}
        <div class="empty muted" data-testid="empty-galleries">No gallery dialogs found. Gallery-type dialogs appear here automatically.</div>
      {:else}
        {#each $galleries as dialog (dialog.id)}
          <DialogItem dialog={dialog} isGallery={true} onToggle={toggleGallery} onOpen={openDialog} />
        {/each}
      {/if}
    </div>
  {:else}
    <div class="list" role="tabpanel" id={tab === 'groups' ? 'groups-tabpanel' : 'chats-tabpanel'} aria-labelledby={tab === 'groups' ? 'groups-tab' : 'chats-tab'} tabindex="0" data-testid={tab === 'groups' ? 'groups-list' : 'chats-list'}>
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

  .status-note {
    margin: 10px 0 0;
    color: var(--color-warning);
    font-size: 0.95rem;
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
