<script lang="ts">
  import { setTelegramApiCredentials } from '../../lib/telegram/adapter'
  import { authState, authStatus, phone, phoneCodeHash, session, telegramAdapter } from '../../stores/telegram'
  import { pushToast } from '../../stores/ui'

  export let hideCredentials: boolean

  let apiId = import.meta.env.VITE_TELEGRAM_API_ID ?? ''
  let apiHash = import.meta.env.VITE_TELEGRAM_API_HASH ?? ''
  let code = ''
  let password = ''

  async function handleSendCode(): Promise<void> {
    const value = $phone.trim()
    if (!value) {
      pushToast({ kind: 'error', text: 'Phone number is required', dismissible: true })
      return
    }

    authState.set('connecting')
    authStatus.set('Connecting...')

    try {
      setTelegramApiCredentials(apiId, apiHash)
      const result = await telegramAdapter.sendCode(value)
      phoneCodeHash.set(result.phoneCodeHash)
      localStorage.setItem('phone', value)
      authStatus.set('Code sent. Check Telegram.')
      authState.set('idle')
    } catch (error) {
      authStatus.set(error instanceof Error ? error.message : 'Failed to send code')
      authState.set('error')
    }
  }

  async function handleSubmitCode(): Promise<void> {
    const hash = $phoneCodeHash
    if (!hash) {
      pushToast({ kind: 'error', text: 'Send a code first', dismissible: true })
      return
    }

    authState.set('connecting')
    authStatus.set('Verifying code...')

    try {
      const result = await telegramAdapter.signIn($phone, code, hash)
      if (result === '2fa_required') {
        authStatus.set('2FA required')
        authState.set('idle')
        return
      }

      const nextSession = telegramAdapter.getSession()
      localStorage.setItem('session', nextSession ?? '')
      session.set({ phone: $phone, session: nextSession })
      authStatus.set('Connected')
      authState.set('connected')
    } catch (error) {
      authStatus.set(error instanceof Error ? error.message : 'Failed to verify code')
      authState.set('error')
    }
  }

  async function handleSubmitPassword(): Promise<void> {
    authState.set('connecting')
    authStatus.set('Checking password...')

    try {
      await telegramAdapter.signIn2FA(password)
      const nextSession = telegramAdapter.getSession()
      localStorage.setItem('session', nextSession ?? '')
      session.set({ phone: $phone, session: nextSession })
      authStatus.set('Connected')
      authState.set('connected')
    } catch (error) {
      authStatus.set(error instanceof Error ? error.message : 'Failed to verify password')
      authState.set('error')
    }
  }
</script>

<div class="stack">
  {#if !hideCredentials}
    <input class="field" bind:value={apiId} placeholder="API ID" />
    <input class="field" bind:value={apiHash} placeholder="API Hash" />
  {/if}

  <input class="field" bind:value={$phone} placeholder="Phone number" />
  <button class="button" type="button" on:click={handleSendCode} disabled={$authState === 'connecting'}>
    Send Code
  </button>

  {#if $phoneCodeHash}
    <input class="field" bind:value={code} placeholder="Verification code" />
    <button class="button secondary" type="button" on:click={handleSubmitCode} disabled={$authState === 'connecting'}>
      Submit Code
    </button>
    <input class="field" bind:value={password} type="password" placeholder="2FA Password" />
    <button class="button ghost" type="button" on:click={handleSubmitPassword} disabled={$authState === 'connecting'}>
      Submit Password
    </button>
  {/if}

  <p class="status muted">{$authStatus}</p>
</div>

<style>
  .stack {
    display: grid;
    gap: 12px;
  }

  .status {
    min-height: 1.3rem;
    margin: 0;
    font-size: 0.92rem;
  }
</style>
