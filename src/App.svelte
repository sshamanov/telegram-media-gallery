<script lang="ts">
  import { onMount } from 'svelte'
  import AuthScreen from './components/auth/AuthScreen.svelte'
  import DialogList from './components/dialogs/DialogList.svelte'
  import GalleryGrid from './components/gallery/GalleryGrid.svelte'
  import ViewerWrapper from './components/gallery/ViewerWrapper.svelte'
  import OfflineBanner from './components/ui/OfflineBanner.svelte'
  import Toast from './components/ui/Toast.svelte'
  import { currentDialog, loadInitialMedia } from './stores/gallery'
  import { setDialogs } from './stores/dialogs'
  import { authState, authStatus, session, telegramAdapter } from './stores/telegram'
  import { isOffline, pushToast } from './stores/ui'

  let dialogsLoaded = false

  async function loadDialogs(): Promise<void> {
    try {
      const dialogs = await telegramAdapter.getDialogs()
      setDialogs(dialogs)
      dialogsLoaded = true
      return
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

  onMount(() => {
    const handleOnline = () => isOffline.set(false)
    const handleOffline = () => isOffline.set(true)

    const initialize = async (): Promise<void> => {
      isOffline.set(!navigator.onLine)

      if ($session.session) {
        authStatus.set('Reconnecting...')
        const connected = await telegramAdapter.reconnect($session.session)
        authState.set(connected ? 'connected' : 'idle')
        authStatus.set(connected ? 'Connected' : 'Connect to Telegram')

        if (connected) {
          dialogsLoaded = false
        }
      }

      if ($authState === 'connected') {
        await loadDialogs()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    initialize()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  })
</script>

<OfflineBanner />

<main class="app-shell">
  {#if $authState !== 'connected'}
    <AuthScreen />
  {:else if $currentDialog}
    <GalleryGrid />
  {:else}
    <DialogList />
  {/if}
</main>

<ViewerWrapper />
<Toast />
