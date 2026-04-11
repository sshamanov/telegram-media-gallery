import { get } from 'svelte/store'
import type { AppSettings, AppTheme } from '../types/telegram'
import { persisted } from './persisted'

const mobile = typeof window !== 'undefined' && window.innerWidth <= 768

const defaultSettings: AppSettings = {
  thumbCacheLimit: mobile ? 1000 : 5000,
  fullCacheLimit: mobile ? 100 : 500,
  maxCacheSizeMb: mobile ? 200 : 500,
  gridColumns: mobile ? 2 : 4,
  defaultHiddenFilters: [],
  theme: 'dark',
}

export const settings = persisted<AppSettings>('settings', defaultSettings)

export function updateSettings(next: Partial<AppSettings>): void {
  settings.update((current) => ({ ...current, ...next }))
}

export function getGridColumns(): number {
  return get(settings).gridColumns
}

/** Apply a theme value to <html data-theme="...">. Call on mount and on change. */
export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return

  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const resolved = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme
  document.documentElement.setAttribute('data-theme', resolved)
}
