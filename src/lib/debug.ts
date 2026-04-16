const isDev = import.meta.env.DEV

export const DEBUG_MEDIA_SIZES = import.meta.env.VITE_DEBUG_MEDIA_SIZES === 'true'

export function debugLog(...args: unknown[]): void {
  if (isDev) {
    console.debug('[telegram-gallery]', ...args)
  }
}

export function debugWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn('[telegram-gallery]', ...args)
  }
}
