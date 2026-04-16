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
  import { allDialogs, galleries, hydrateDialogsFromSnapshot, setDialogs } from './stores/dialogs'
  import { authState, authStatus, session, getCurrentAdapter, handleDisconnect } from './stores/telegram'
  import { isOffline, pushToast } from './stores/ui'
  import { initializeFullMediaStorage, type FullMediaStorageState } from './lib/cache/opfs'
  import { applyTheme, settings, setFullMediaStorageState } from './stores/settings'
  import { getKeyboardShortcutsManager } from './lib/dom/keyboard-shortcuts'
  import { createRouterStore } from './lib/routing'
  import { routeTransition } from './lib/dom/transitions'

  let dialogsLoaded = false
  let dialogsLoading = false
  let migrating = false
  let migrationProgress = 0
  let fullMediaStorageState: FullMediaStorageState | null = null
  
  // Router store
  const router = createRouterStore()

  async function runMigrationIfNeeded(): Promise<void> {
    const next = await initializeFullMediaStorage((state) => {
      fullMediaStorageState = state
      setFullMediaStorageState(state)
      migrating = state.migrationStatus === 'running'
      migrationProgress = state.totalEntries > 0
        ? Math.round((state.processedEntries / state.totalEntries) * 100)
        : 100
    })

    fullMediaStorageState = next
    setFullMediaStorageState(next)
    migrating = next.migrationStatus === 'running'
    migrationProgress = next.totalEntries > 0
      ? Math.round((next.processedEntries / next.totalEntries) * 100)
      : 100
  }

  async function loadDialogs(): Promise<void> {
    if (dialogsLoading) {
      return
    }

    dialogsLoading = true

    try {
      const dialogs = await getCurrentAdapter().getDialogs()
      setDialogs(dialogs)
      dialogsLoaded = true
    } catch (error) {
      if (!navigator.onLine && hydrateDialogsFromSnapshot()) {
        dialogsLoaded = true
        return
      }

      dialogsLoaded = true
      pushToast({ kind: 'error', text: 'Failed to load dialogs', dismissible: true })
    } finally {
      dialogsLoading = false
    }
  }

  $: if ($authState === 'connected' && !dialogsLoaded && !dialogsLoading && !$isOffline) {
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
        if ($session.session) {
          authStatus.set('Reconnecting...')
          const connected = await getCurrentAdapter().reconnect($session.session)

          if (!connected) {
            authState.set('idle')
            authStatus.set('Connect to Telegram')
            return
          }

          authStatus.set('Connected')
        }

        // Silent refresh when connection restores
        dialogsLoaded = false
      } else if ($authState !== 'idle') {
        // Was disconnected mid-session — try to reconnect
        void handleDisconnect()
      }
    }
    const handleOffline = () => isOffline.set(true)

    const initialize = async (): Promise<void> => {
      const offline = !navigator.onLine

      isOffline.set(offline)

      // Run OPFS migration before rendering main UI
      await runMigrationIfNeeded()

      if ($session.session) {
        if (offline) {
          authState.set('connected')
          authStatus.set('Offline - showing last synced dialogs')
          dialogsLoaded = hydrateDialogsFromSnapshot()
        } else {
          authStatus.set('Reconnecting...')
          const connected = await getCurrentAdapter().reconnect($session.session)
          authState.set(connected ? 'connected' : 'idle')
          authStatus.set(connected ? 'Connected' : 'Connect to Telegram')
          if (connected) {
            dialogsLoaded = false
          }
        }
      }

      if ($authState === 'connected' && !offline) {
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
  <MigrationScreen
    progress={migrationProgress}
    processedEntries={fullMediaStorageState?.processedEntries ?? 0}
    totalEntries={fullMediaStorageState?.totalEntries ?? 0}
  />
    {:else}
    <main class="app-shell">
    <div class="route-container" use:routeTransition>
      {#if $authState !== 'connected'}
        <div data-testid="auth-screen">
          <AuthScreen />
        </div>
      {:else if $router.type === 'settings'}
        <div data-testid="settings-screen">
          <SettingsScreen />
        </div>
      {:else if $currentDialog && $router.type === 'gallery' && $router.dialogId === $currentDialog.id}
        <div data-testid="gallery-screen">
          <GalleryGrid />
        </div>
      {:else}
        <div data-testid="dialogs-screen">
          <DialogList />
        </div>
      {/if}
    </div>
  </main>
{/if}

<ViewerWrapper />
<Toast />
