<script lang="ts">
  import { onMount } from 'svelte'
  import PhoneForm from './PhoneForm.svelte'
  import QRForm from './QRForm.svelte'
  import { getUseMock, setUseMock, setTelegramAdapter } from '../../lib/telegram/adapter'
  import { mockAdapter } from '../../lib/telegram/mock'
  import { mtcuteAdapter } from '../../lib/telegram/mtcute'
  import { pushToast } from '../../stores/ui'

  let mode: 'phone' | 'qr' = 'phone'
  let webCryptoAvailable = true
  let useMock = getUseMock()

  const hideCredentials = Boolean(import.meta.env.VITE_TELEGRAM_API_ID && import.meta.env.VITE_TELEGRAM_API_HASH)

  onMount(() => {
    webCryptoAvailable = Boolean(window.isSecureContext && window.crypto?.subtle)
  })

  function toggleMockMode(): void {
    useMock = !useMock
    setUseMock(useMock)
    setTelegramAdapter(useMock ? mockAdapter : mtcuteAdapter)
    
    // Clear any existing session when switching adapters
    localStorage.removeItem('session')
    localStorage.removeItem('phone')
    
    pushToast({
      kind: 'info',
      text: `Switched to ${useMock ? 'mock' : 'real'} Telegram adapter`,
      dismissible: true
    })
  }
</script>

<section class="auth-screen">
  <div class="hero">
    <p class="eyebrow">Telegram media hub</p>
    <h1>Telegram Gallery</h1>
    <p class="muted">Phone, code, 2FA, and QR login in a single browser-based client.</p>
  </div>

  <div class="panel auth-card">
    {#if !webCryptoAvailable}
      <div class="crypto-warning">
        WebCrypto is not available. Open the app via `http://localhost:5174`, not the network IP address.
      </div>
    {/if}

    <div class="tabs">
      <button class:active={mode === 'phone'} class="tab" type="button" on:click={() => (mode = 'phone')}>Phone</button>
      <button class:active={mode === 'qr'} class="tab" type="button" on:click={() => (mode = 'qr')}>QR Code</button>
    </div>

    <div class="mock-toggle">
      <label class="toggle-label">
        <input type="checkbox" bind:checked={useMock} on:change={toggleMockMode} />
        <span class="toggle-slider"></span>
        <span class="toggle-text">Use mock data</span>
      </label>
      {#if useMock}
        <div class="mock-hint muted">
          Mock mode: any phone works, code 123456 triggers 2FA (password: "password")
        </div>
      {/if}
    </div>

    {#if mode === 'phone'}
      <PhoneForm {hideCredentials} />
    {:else}
      <QRForm />
    {/if}
  </div>
</section>

<style>
  .auth-screen {
    min-height: calc(100vh - 72px);
    min-height: calc(100dvh - 72px);
    display: grid;
    align-items: center;
    gap: 24px;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 460px);
  }

  .hero h1 {
    margin: 0 0 12px;
    font-size: clamp(2.6rem, 7vw, 4.8rem);
    line-height: 0.95;
    color: var(--accent);
  }

  .eyebrow {
    margin: 0 0 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-secondary);
    font-size: 0.78rem;
  }

  .auth-card {
    padding: 18px;
  }

  .crypto-warning {
    margin-bottom: 16px;
    padding: 12px 14px;
    color: #201400;
    background: var(--color-warning);
    border-radius: 12px;
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 999px;
  }

  .tab {
    flex: 1;
    border: 0;
    color: var(--text-secondary);
    background: transparent;
    border-radius: 999px;
    padding: 12px;
  }

  .tab.active {
    color: var(--text-primary);
    background: var(--bg-elevated);
  }

  .mock-toggle {
    margin-bottom: 18px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }

  .toggle-label input {
    display: none;
  }

  .toggle-slider {
    position: relative;
    width: 36px;
    height: 20px;
    background: var(--bg-input);
    border-radius: 999px;
    transition: background 0.2s;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    background: var(--text-primary);
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }

  .toggle-label input:checked + .toggle-slider {
    background: var(--accent);
  }

  .toggle-label input:checked + .toggle-slider::before {
    transform: translateX(16px);
  }

  .toggle-text {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .mock-hint {
    margin-top: 8px;
    font-size: 0.8rem;
    line-height: 1.3;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
  }

  @media (max-width: 860px) {
    .auth-screen {
      grid-template-columns: 1fr;
      padding-top: 32px;
    }
  }

  @media (max-width: 480px) {
    .auth-screen {
      gap: 18px;
      min-height: auto;
    }

    .hero h1 {
      font-size: clamp(2.1rem, 12vw, 3rem);
    }
  }
</style>
