<script lang="ts">
  import { onMount } from 'svelte'
  import AuthScreen from './components/auth/AuthScreen.svelte'
  import DialogList from './components/dialogs/DialogList.svelte'
  import GalleryGrid from './components/gallery/GalleryGrid.svelte'
  import ViewerWrapper from './components/gallery/ViewerWrapper.svelte'
  import OfflineBanner from './components/ui/OfflineBanner.svelte'
  import Toast from './components/ui/Toast.svelte'
  import MigrationScreen from './components/ui/MigrationScreen.svelte'
  import ReconnectBanner from './components/ui/ReconnectBanner.svelte'
  import { currentDialog, loadInitialMedia } from './stores/gallery'
  import { setDialogs } from './stores/dialogs'
  import { authState, authStatus, session, telegramAdapter, handleDisconnect } from './stores/telegram'
  import { isOffline, pushToast } from './stores/ui'
  import { migrateIndexedDbToOpfs, isOpfsAvailable } from './lib/cache/opfs'
  import { applyTheme, settings } from './stores/settings'

  const MIGRATION_KEY = 'opfs-migration-v1-done'

  let dialogsLoaded = false
  let migrating = false
  let migrationProgress = 0   // 0–100

  async function runMigrationIfNeeded(): Promise<void> {
    if (!isOpfsAvailable()) return
    if (localStorage.getItem(MIGRATION_KEY)) return

    migrating = true
    migrationProgress = 0

    try {
      await migrateIndexedDbToOpfs((done, total) => {
        migrationProgress = total > 0 ? Math.round((done / total) * 100) : 100
      })
      localStorage.setItem(MIGRATION_KEY, '1')
    } catch {
      // Partial migration is fine — missing items re-downloaded on demand
    } finally {
      migrating = false
    }
  }

  async function loadDialogs(): Promise<void> {
    try {
      const dialogs = await telegramAdapter.getDialogs()
      setDialogs(dialogs)
      dialogsLoaded = true
    } catch {
      setDialogs([])
      pushToast({ kind: 'error', text: 'Failed to load dialogs', dismissible: true })
    }
  }

  $: if ($authState === 'connected' && !dialogsLoaded) {
    void loadDialogs()
  }

  $: if ($authState === 'connected' && $currentDialog) {
    void loadInitialMedia()
  }

  // Apply theme immediately and whenever setting changes
  $: applyTheme($settings.theme)

  onMount(() => {
    // Also track system preference changes for 'system' theme
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handleMq = () => applyTheme($settings.theme)
    mq.addEventListener('change', handleMq)

    const handleOnline = async () => {
      isOffline.set(false)
      if ($authState === 'connected') {
        // Silent refresh when connection restores
        dialogsLoaded = false
      } else if ($authState !== 'idle') {
        // Was disconnected mid-session — try to reconnect
        void handleDisconnect()
      }
    }
    const handleOffline = () => isOffline.set(true)

    const initialize = async (): Promise<void> => {
      isOffline.set(!navigator.onLine)

      // Run OPFS migration before rendering main UI
      await runMigrationIfNeeded()

      if ($session.session) {
        authStatus.set('Reconnecting...')
        const connected = await telegramAdapter.reconnect($session.session)
        authState.set(connected ? 'connected' : 'idle')
        authStatus.set(connected ? 'Connected' : 'Connect to Telegram')
        if (connected) dialogsLoaded = false
      }

      if ($authState === 'connected') {
        await loadDialogs()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    void initialize()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      mq.removeEventListener('change', handleMq)
    }
  })
</script>

<OfflineBanner />
<ReconnectBanner />

{#if migrating}
  <MigrationScreen progress={migrationProgress} />
{:else}
  <main class="app-shell">
    {#if $authState !== 'connected'}
      <AuthScreen />
    {:else if $currentDialog}
      <GalleryGrid />
    {:else}
      <DialogList />
    {/if}
  </main>
{/if}

<ViewerWrapper />
<Toast />
