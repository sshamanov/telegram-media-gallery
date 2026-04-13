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
  import SettingsScreen from './components/settings/SettingsScreen.svelte'
  import { currentDialog, loadInitialMedia, setActiveDialog } from './stores/gallery'
  import { allDialogs, galleries, setDialogs } from './stores/dialogs'
  import { authState, authStatus, session, getCurrentAdapter, handleDisconnect } from './stores/telegram'
  import { isOffline, pushToast } from './stores/ui'
  import { migrateIndexedDbToOpfs, isOpfsAvailable } from './lib/cache/opfs'
  import { applyTheme, settings } from './stores/settings'
  import { getKeyboardShortcutsManager } from './lib/dom/keyboard-shortcuts'
  import { createRouterStore } from './lib/routing'
  import { routeTransition } from './lib/dom/transitions'

  const MIGRATION_KEY = 'opfs-migration-v1-done'

  let dialogsLoaded = false
  let migrating = false
  let migrationProgress = 0   // 0–100
  
  // Router store
  const router = createRouterStore()

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
       const dialogs = await getCurrentAdapter().getDialogs()
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

  // Sync router with app state
  $: if ($authState === 'connected') {
    // When router changes to gallery route, set current dialog
    if ($router.type === 'gallery') {
      const dialog = [...$galleries, ...$allDialogs].find(d => d.id === $router.dialogId)
      if (dialog && (!$currentDialog || $currentDialog.id !== dialog.id)) {
        setActiveDialog(dialog)
      }
    }
  }

  // Apply theme immediately and whenever setting changes
  $: applyTheme($settings.theme)

  onMount(() => {
    // Initialize keyboard shortcuts manager
    getKeyboardShortcutsManager()
    
    // Listen for navigation events
    const handleOpenSettings = () => {
      router.navigate({ type: 'settings' })
    }
    
    document.addEventListener('open-settings', handleOpenSettings)
    
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
         const connected = await getCurrentAdapter().reconnect($session.session)
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
      document.removeEventListener('open-settings', handleOpenSettings)
      router.destroy()
    }
  })
</script>

<OfflineBanner />
<ReconnectBanner />

{#if migrating}
  <MigrationScreen progress={migrationProgress} />
   {:else}
  <main class="app-shell">
    <div class="route-container" use:routeTransition>
      {#if $authState !== 'connected'}
        <AuthScreen />
      {:else if $router.type === 'settings'}
        <SettingsScreen />
      {:else if $currentDialog && $router.type === 'gallery' && $router.dialogId === $currentDialog.id}
        <GalleryGrid />
      {:else}
        <DialogList />
      {/if}
    </div>
  </main>
{/if}

<ViewerWrapper />
<Toast />
