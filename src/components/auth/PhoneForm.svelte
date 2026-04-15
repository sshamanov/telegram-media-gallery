<script lang="ts">
  import { setTelegramApiCredentials } from '../../lib/telegram/adapter'
  import { debugLog, debugWarn } from '../../lib/debug'
  import { authState, authStatus, phone, phoneCodeHash, session, getCurrentAdapter } from '../../stores/telegram'
  import { pushToast } from '../../stores/ui'

  export let hideCredentials: boolean

  let apiId = import.meta.env.VITE_TELEGRAM_API_ID ?? ''
  let apiHash = import.meta.env.VITE_TELEGRAM_API_HASH ?? ''
  let code = ''
  let password = ''
  
  type Step = 'phone' | 'code' | 'password'
  let step: Step = 'phone'
  let needs2FA = false

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
      debugLog('auth:phone:sendCode', {
        phone: value,
        hasApiId: Boolean(apiId.trim()),
        hasApiHash: Boolean(apiHash.trim()),
      })
      const result = await getCurrentAdapter().sendCode(value)
      phoneCodeHash.set(result.phoneCodeHash)
      localStorage.setItem('phone', value)
      step = 'code'
      needs2FA = false
      authStatus.set('Code sent. Check Telegram.')
      authState.set('idle')
    } catch (error) {
      debugWarn('auth:phone:sendCode:error', error)
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
      debugLog('auth:phone:submitCode', {
        phone: $phone,
        codeLength: code.length,
        hasHash: Boolean(hash),
      })
      const result = await getCurrentAdapter().signIn($phone, code, hash)
      if (result === '2fa_required') {
        step = 'password'
        needs2FA = true
        authStatus.set('2FA password required')
        authState.set('idle')
        return
      }

      const nextSession = getCurrentAdapter().getSession()
      localStorage.setItem('session', nextSession ?? '')
      session.set({ phone: $phone, session: nextSession })
      authStatus.set('Connected')
      authState.set('connected')
    } catch (error) {
      debugWarn('auth:phone:submitCode:error', error)
      authStatus.set(error instanceof Error ? error.message : 'Failed to verify code')
      authState.set('error')
    }
  }

  async function handleSubmitPassword(): Promise<void> {
    authState.set('connecting')
    authStatus.set('Checking password...')

    try {
      debugLog('auth:phone:submitPassword', {
        passwordLength: password.length,
      })
      await getCurrentAdapter().signIn2FA(password)
      const nextSession = getCurrentAdapter().getSession()
      localStorage.setItem('session', nextSession ?? '')
      session.set({ phone: $phone, session: nextSession })
      authStatus.set('Connected')
      authState.set('connected')
    } catch (error) {
      debugWarn('auth:phone:submitPassword:error', error)
      authStatus.set(error instanceof Error ? error.message : 'Failed to verify password')
      authState.set('error')
    }
  }

  function resetForm(): void {
    step = 'phone'
    needs2FA = false
    code = ''
    password = ''
    phoneCodeHash.set(null)
    authStatus.set('Connect to Telegram')
  }
</script>

<div class="stack" data-auth-step={step} data-testid="phone-form">
  {#if !hideCredentials}
    <input class="field" bind:value={apiId} placeholder="API ID" />
    <input class="field" bind:value={apiHash} placeholder="API Hash" />
  {/if}

  <input 
    class="field" 
    bind:value={$phone} 
    placeholder="Phone number" 
    on:keydown={(e) => e.key === 'Enter' && step === 'phone' && handleSendCode()}
    data-testid="phone-input"
  />

  {#if step === 'phone'}
    <button class="button" type="button" on:click={handleSendCode} disabled={$authState === 'connecting'} data-testid="send-code-button">
      Send Code
    </button>
  {:else if step === 'code'}
    <input 
      class="field" 
      bind:value={code} 
      placeholder="Verification code" 
      on:keydown={(e) => e.key === 'Enter' && handleSubmitCode()}
      data-testid="verification-code-input"
    />
    <button class="button secondary" type="button" on:click={handleSubmitCode} disabled={$authState === 'connecting'} data-testid="submit-code-button">
      Submit Code
    </button>
    <p class="help muted">Enter the code sent to your Telegram app.</p>
  {:else if step === 'password'}
    <input 
      class="field" 
      bind:value={code} 
      placeholder="Verification code" 
      on:keydown={(e) => e.key === 'Enter' && handleSubmitCode()}
      disabled
    />
    <button class="button secondary" type="button" on:click={handleSubmitCode} disabled={$authState === 'connecting'}>
      Submit Code
    </button>
    {#if needs2FA}
      <input 
        class="field" 
        bind:value={password} 
        type="password" 
        placeholder="2FA Password" 
        on:keydown={(e) => e.key === 'Enter' && handleSubmitPassword()}
        data-testid="2fa-password-input"
      />
      <button class="button ghost" type="button" on:click={handleSubmitPassword} disabled={$authState === 'connecting'} data-testid="submit-password-button">
        Submit Password
      </button>
      <p class="help muted">Your account has 2-step verification enabled.</p>
    {/if}
  {/if}

  <p class="status muted" aria-live="polite" data-testid="auth-status">{$authStatus}</p>
  
  {#if step !== 'phone'}
    <button class="button ghost small" type="button" on:click={resetForm}>
      ← Back to phone entry
    </button>
  {/if}
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

  .help {
    margin: 4px 0 0;
    font-size: 0.85rem;
    line-height: 1.3;
  }

  .small {
    font-size: 0.85rem;
    padding: 6px 12px;
  }
</style>
