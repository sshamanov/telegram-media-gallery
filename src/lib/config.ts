// Runtime config injected by /config.js (generated from container env by scripts/serve-dist.mjs).
// Falls back to build-time VITE_* values for local development.
const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined

export const TELEGRAM_API_ID: string = runtime?.telegramApiId || import.meta.env.VITE_TELEGRAM_API_ID || ''
export const TELEGRAM_API_HASH: string = runtime?.telegramApiHash || import.meta.env.VITE_TELEGRAM_API_HASH || ''
