const isDev = import.meta.env.DEV

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
