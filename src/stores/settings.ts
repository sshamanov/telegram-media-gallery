import { get } from 'svelte/store'
import type { AppSettings } from '../types/telegram'
import { persisted } from './persisted'

const mobile = typeof window !== 'undefined' && window.innerWidth <= 768

const defaultSettings: AppSettings = {
  thumbCacheLimit: mobile ? 1000 : 5000,
  fullCacheLimit: mobile ? 100 : 500,
  maxCacheSizeMb: mobile ? 200 : 500,
  gridColumns: mobile ? 2 : 4,
  defaultHiddenFilters: [],
}

export const settings = persisted<AppSettings>('settings', defaultSettings)

export function updateSettings(next: Partial<AppSettings>): void {
  settings.update((current) => ({ ...current, ...next }))
}

export function getGridColumns(): number {
  return get(settings).gridColumns
}
