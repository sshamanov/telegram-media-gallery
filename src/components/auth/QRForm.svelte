<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import QRCode from 'qrcode'
  import { setTelegramApiCredentials } from '../../lib/telegram/adapter'
  import { authState, authStatus, session, getCurrentAdapter } from '../../stores/telegram'

  let canvas: HTMLCanvasElement | null = null
  let expiresIn = 0
  let countdown: number | null = null
  let running = false
  let apiId = localStorage.getItem('telegram.apiId') ?? import.meta.env.VITE_TELEGRAM_API_ID ?? ''
  let apiHash = localStorage.getItem('telegram.apiHash') ?? import.meta.env.VITE_TELEGRAM_API_HASH ?? ''

  // 2FA state — only shown when Telegram asks for it mid-login
  let needs2FA = false
  let password2FA = ''
  let passwordResolver: ((pw: string) => void) | null = null

  const hideCredentials = Boolean(import.meta.env.VITE_TELEGRAM_API_ID && import.meta.env.VITE_TELEGRAM_API_HASH)

  function clearCountdown(): void {
    if (countdown !== null) {
      window.clearInterval(countdown)
      countdown = null
    }
  }

  /** Called by mtcute when 2FA is required after the QR scan is confirmed. */
  function requestPassword(): Promise<string> {
    needs2FA = true
    authStatus.set('2FA password required. Enter it below and click Submit.')
    return new Promise<string>((resolve) => {
      passwordResolver = resolve
    })
  }

  function submit2FA(): void {
    if (passwordResolver && password2FA.trim()) {
      const resolver = passwordResolver
      passwordResolver = null
      needs2FA = false
      authStatus.set('Verifying 2FA…')
      resolver(password2FA.trim())
    }
  }

  async function start(): Promise<void> {
    if (!canvas || running) return

    if (!hideCredentials && (!apiId.trim() || !apiHash.trim())) {
      authStatus.set('API ID and API Hash are required for QR login')
      return
    }

    setTelegramApiCredentials(apiId, apiHash)
    needs2FA = false
    password2FA = ''
    passwordResolver = null
    running = true
    authStatus.set('Loading QR code…')

    try {
       for await (const qr of getCurrentAdapter().startQRLogin(requestPassword)) {
        expiresIn = Math.max(0, Math.round((qr.expires - Date.now()) / 1000))
        await QRCode.toCanvas(canvas, qr.token, {
          margin: 1,
          width: 256,
          color: { dark: '#0088cc', light: '#f7fbff' },
        })

        clearCountdown()
        countdown = window.setInterval(() => {
          expiresIn = Math.max(0, expiresIn - 1)
        }, 1000)

        authStatus.set('Scan the QR code with Telegram on your phone')
      }

       const nextSession = getCurrentAdapter().getSession()
      if (nextSession) {
        localStorage.setItem('session', nextSession)
        session.set({ phone: localStorage.getItem('phone') ?? undefined, session: nextSession })
        authStatus.set('Connected')
        authState.set('connected')
      } else {
        authStatus.set('QR login did not complete. Press Refresh.')
      }
    } catch (error) {
      authStatus.set(error instanceof Error ? error.message : 'QR login is unavailable')
    } finally {
      running = false
      clearCountdown()
    }
  }

  onMount(() => { void start() })
  onDestroy(() => { clearCountdown() })
</script>

<div class="qr-form" data-testid="qr-form">
  <p class="muted">Scan this QR code with Telegram on your phone to log in.</p>

  {#if !hideCredentials}
    <div class="credentials">
      <input class="field" bind:value={apiId} placeholder="API ID" />
      <input class="field" bind:value={apiHash} placeholder="API Hash" />
    </div>
  {/if}

  <canvas bind:this={canvas} width="256" height="256" data-testid="qr-canvas"></canvas>

  <div class="row">
    <span class="muted">Expires in {expiresIn}s</span>
    <button class="button ghost" type="button" on:click={start} disabled={running} data-testid="qr-refresh-button">Refresh</button>
  </div>

  {#if needs2FA}
    <div class="twofa-block" data-testid="qr-2fa-section">
      <p class="muted">Your account has 2-step verification enabled.</p>
      <input
        class="field"
        type="password"
        bind:value={password2FA}
        placeholder="2FA password"
        on:keydown={(e) => e.key === 'Enter' && submit2FA()}
        data-testid="qr-2fa-password-input"
      />
      <button class="button" type="button" on:click={submit2FA} disabled={!password2FA.trim()} data-testid="qr-2fa-submit-button">
        Submit
      </button>
    </div>
  {/if}
</div>

<style>
  .qr-form {
    display: grid;
    justify-items: center;
    gap: 16px;
    padding-top: 8px;
  }

  .credentials {
    display: grid;
    gap: 10px;
    width: min(100%, 320px);
  }

  canvas {
    display: block;
    width: min(256px, 100%);
    height: auto;
    padding: 14px;
    background: white;
    border-radius: 20px;
  }

  .row {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  @media (max-width: 480px) {
    .row {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
    }
  }

  .twofa-block {
    display: grid;
    gap: 10px;
    width: min(100%, 320px);
    padding: 14px;
    border: 1px solid var(--border-focus);
    border-radius: 14px;
  }

  .twofa-block p {
    margin: 0;
  }
</style>
