/**
 * Desktop detection and layout utilities for Telegram Gallery
 */

import { writable, derived } from 'svelte/store'
import { settings } from '../../stores/settings'
import type { DesktopLayoutMode } from '../../types/telegram'

// Screen size detection
export const isDesktop = writable(false)
export const screenWidth = writable(0)

if (typeof window !== 'undefined') {
  // Initialize values
  screenWidth.set(window.innerWidth)
  isDesktop.set(window.innerWidth > 1024)
  
  // Update on resize
  window.addEventListener('resize', () => {
    screenWidth.set(window.innerWidth)
    isDesktop.set(window.innerWidth > 1024)
  })
}

/**
 * Get effective desktop layout based on screen size and user preference
 */
export const effectiveDesktopLayout = derived(
  [isDesktop, settings],
  ([$isDesktop, $settings]) => {
    if (!$isDesktop) {
      return null // Not on desktop
    }
    return $settings.desktopLayout
  }
)

/**
 * Check if a specific desktop layout is active
 */
export function isDesktopLayoutActive(_layout: DesktopLayoutMode): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth > 1024
}

/**
 * Get CSS class for desktop layout
 */
export function getDesktopLayoutClass(layout: DesktopLayoutMode | null): string {
  if (!layout) return ''
  
  switch (layout) {
    case 'wide':
      return 'desktop-wide'
    case 'sidebar':
      return 'desktop-sidebar'
    case 'dual':
      return 'desktop-dual'
    default:
      return ''
  }
}

/**
 * Get grid columns for desktop layout
 */
export function getDesktopGridColumns(layout: DesktopLayoutMode | null): number {
  if (!layout) return 4 // Default
  
  switch (layout) {
    case 'wide':
      return 6
    case 'sidebar':
      return 5
    case 'dual':
      return 4
    default:
      return 4
  }
}

/**
 * Apply desktop layout styles to document
 */
export function applyDesktopLayoutStyles(layout: DesktopLayoutMode | null): void {
  if (typeof document === 'undefined') return
  
  // Remove existing desktop layout classes
  document.documentElement.classList.remove(
    'desktop-wide',
    'desktop-sidebar', 
    'desktop-dual'
  )
  
  // Add new class if on desktop
  if (layout && window.innerWidth > 1024) {
    document.documentElement.classList.add(`desktop-${layout}`)
  }
}

// Subscribe to layout changes
if (typeof window !== 'undefined') {
  effectiveDesktopLayout.subscribe(applyDesktopLayoutStyles)
}