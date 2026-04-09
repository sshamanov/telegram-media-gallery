/**
 * Telegram authentication module.
 * Manages TelegramClient lifecycle, session persistence, and auth flow.
 * Extracted from src-reference/main.js lines 289–477.
 *
 * See kilo-dev-process.md § 5.1 for extraction notes.
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {TelegramClient | null} */
export let client = null;

/** @type {string} */
let phoneCodeHash = '';

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/**
 * Read stored credentials from localStorage / environment.
 * @returns {{ apiId: string, apiHash: string, session: string | null }}
 */
export function getStoredCredentials() {
  const ENV_API_ID = import.meta.env.VITE_TELEGRAM_API_ID || '';
  const ENV_API_HASH = import.meta.env.VITE_TELEGRAM_API_HASH || '';
  return {
    apiId: localStorage.getItem('apiId') || ENV_API_ID,
    apiHash: localStorage.getItem('apiHash') || ENV_API_HASH,
    session: localStorage.getItem('session'),
    envApiId: ENV_API_ID,
    envApiHash: ENV_API_HASH,
  };
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/**
 * Reconnect using a stored session string.
 * @param {function(string): void} onStatus  - status update callback
 * @param {function(): void} onSuccess       - called when reconnect succeeds
 */
export async function reconnect(onStatus, onSuccess) {
  const { apiId, apiHash, session } = getStoredCredentials();

  if (!session || !apiId || !apiHash) return;

  try {
    onStatus('Reconnecting...');
    const stringSession = new StringSession(session);
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    if (await client.isUserAuthorized()) {
      onStatus('Connected!');
      onSuccess();
    } else {
      onStatus('Please login');
    }
  } catch (error) {
    console.error('Reconnect failed:', error);
    onStatus('Please login');
    localStorage.removeItem('session');
  }
}

// ---------------------------------------------------------------------------
// Auth flow
// ---------------------------------------------------------------------------

/**
 * Step 1: Send SMS verification code.
 * @param {string} apiId
 * @param {string} apiHash
 * @param {string} phone
 * @param {function(string): void} onStatus
 * @param {function(): void} onCodeSent  - called when code input should be shown
 */
export async function sendCode(apiId, apiHash, phone, onStatus, onCodeSent) {
  if (!apiId || !apiHash || !phone) {
    onStatus('Please fill all fields');
    return;
  }

  try {
    onStatus('Connecting...');
    localStorage.setItem('apiId', apiId);
    localStorage.setItem('apiHash', apiHash);
    localStorage.setItem('phone', phone);

    const stringSession = new StringSession('');
    client = new TelegramClient(stringSession, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const { Api } = await import('telegram/tl/api.js');
    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: parseInt(apiId),
        apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    phoneCodeHash = result.phoneCodeHash;
    onStatus('Code sent! Check your Telegram');
    onCodeSent();
  } catch (error) {
    onStatus('Error: ' + error.message);
    console.error(error);
  }
}

/**
 * Step 2: Submit verification code.
 * @param {string} code
 * @param {function(string): void} onStatus
 * @param {function(): void} onSuccess
 * @param {function(): void} on2FARequired
 */
export async function submitCode(code, onStatus, onSuccess, on2FARequired) {
  if (!code) {
    onStatus('Please enter code');
    return;
  }

  try {
    onStatus('Verifying code...');
    const { Api } = await import('telegram/tl/api.js');
    const phone = localStorage.getItem('phone');

    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code,
      })
    );

    if (result.className === 'auth.Authorization') {
      localStorage.setItem('session', client.session.save());
      onStatus('Connected!');
      onSuccess();
    }
  } catch (error) {
    if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
      onStatus('2FA required');
      on2FARequired();
    } else {
      onStatus('Error: ' + error.message);
      console.error(error);
    }
  }
}

/**
 * Step 3 (optional): Submit 2FA password.
 * @param {string} password
 * @param {function(string): void} onStatus
 * @param {function(): void} onSuccess
 */
export async function submitPassword(password, onStatus, onSuccess) {
  if (!password) {
    onStatus('Please enter password');
    return;
  }

  try {
    onStatus('Verifying password...');
    const { Api } = await import('telegram/tl/api.js');
    const { computeCheck } = await import('telegram/Password.js');

    const passwordInfo = await client.invoke(new Api.account.GetPassword());
    const passwordCheck = await computeCheck(passwordInfo, password);

    const result = await client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));

    if (result.className === 'auth.Authorization') {
      localStorage.setItem('session', client.session.save());
      onStatus('Connected!');
      onSuccess();
    }
  } catch (error) {
    onStatus('Error: ' + error.message);
    console.error(error);
  }
}

/**
 * Log out: revoke session, clear localStorage, reload page.
 */
export async function logout() {
  try {
    if (client) {
      const { Api } = await import('telegram/tl/api.js');
      await client.invoke(new Api.auth.LogOut());
    }
  } catch (error) {
    console.error(error);
  }
  localStorage.clear();
  location.reload();
}
