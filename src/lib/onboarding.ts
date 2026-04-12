/**
 * Onboarding system for first-time user hints
 * 
 * Features:
 * - Shows hints on first visit
 * - Respects user preferences (dismissible)
 * - Tracks which hints have been shown
 * - Supports different hint types
 */

export interface OnboardingHint {
  /** Unique identifier for the hint */
  id: string
  /** Title of the hint */
  title: string
  /** Description/instructions */
  description: string
  /** Where to show the hint (component/context) */
  context: 'gallery' | 'dialog-list' | 'viewer' | 'settings'
  /** Priority (higher = shown first) */
  priority?: number
  /** Whether hint is dismissible */
  dismissible?: boolean
  /** Maximum times to show (0 = unlimited) */
  maxShows?: number
}

export interface OnboardingState {
  /** Hints that have been shown */
  shownHints: Record<string, number>
  /** Whether onboarding is enabled */
  enabled: boolean
}

const DEFAULT_HINTS: OnboardingHint[] = [
  {
    id: 'selection-mode',
    title: 'Select Multiple Items',
    description: 'Long-press on any item to enter selection mode. You can then select multiple items to download, forward, or share.',
    context: 'gallery',
    priority: 10,
    dismissible: true,
    maxShows: 3,
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Press ? anywhere in the app to see available keyboard shortcuts for faster navigation.',
    context: 'gallery',
    priority: 5,
    dismissible: true,
    maxShows: 2,
  },
  {
    id: 'pull-to-refresh',
    title: 'Pull to Refresh',
    description: 'Pull down from the top of the gallery to refresh and load new media.',
    context: 'gallery',
    priority: 3,
    dismissible: true,
    maxShows: 2,
  },
]

const STORAGE_KEY = 'telegram-gallery-onboarding'

class OnboardingManager {
  private state: OnboardingState
  private hints: OnboardingHint[] = DEFAULT_HINTS

  constructor() {
    this.state = this.loadState()
  }

  /**
   * Load onboarding state from localStorage
   */
  private loadState(): OnboardingState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Ignore errors
    }
    
    return {
      shownHints: {},
      enabled: true,
    }
  }

  /**
   * Save onboarding state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      // Ignore errors
    }
  }

  /**
   * Check if a hint should be shown
   */
  shouldShowHint(hintId: string, context: string): boolean {
    if (!this.state.enabled) return false
    
    const hint = this.hints.find(h => h.id === hintId)
    if (!hint) return false
    
    // Check context
    if (hint.context !== context) return false
    
    // Check max shows
    const timesShown = this.state.shownHints[hintId] || 0
    if (hint.maxShows !== undefined && timesShown >= hint.maxShows) {
      return false
    }
    
    return true
  }

  /**
   * Mark a hint as shown
   */
  markHintAsShown(hintId: string): void {
    const currentCount = this.state.shownHints[hintId] || 0
    this.state.shownHints[hintId] = currentCount + 1
    this.saveState()
  }

  /**
   * Get hints for a specific context
   */
  getHintsForContext(context: string): OnboardingHint[] {
    return this.hints
      .filter(hint => hint.context === context && this.shouldShowHint(hint.id, context))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  /**
   * Dismiss a hint (user clicked "Got it")
   */
  dismissHint(hintId: string): void {
    this.markHintAsShown(hintId)
  }

  /**
   * Enable/disable onboarding
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled
    this.saveState()
  }

  /**
   * Reset all onboarding state
   */
  reset(): void {
    this.state = {
      shownHints: {},
      enabled: true,
    }
    this.saveState()
  }

  /**
   * Get current state
   */
  getState(): OnboardingState {
    return { ...this.state }
  }
}

// Singleton instance
let instance: OnboardingManager | null = null

export function getOnboardingManager(): OnboardingManager {
  if (!instance) {
    instance = new OnboardingManager()
  }
  return instance
}

/**
 * Create a hint element
 */
export function createHintElement(hint: OnboardingHint, onDismiss?: () => void): HTMLElement {
  const element = document.createElement('div')
  element.className = 'onboarding-hint'
  element.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 320px;
    background: var(--bg-surface);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border);
    z-index: 1000;
    animation: slideInUp 0.3s ease;
  `

  const title = document.createElement('h3')
  title.textContent = hint.title
  title.style.cssText = `
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  `

  const description = document.createElement('p')
  description.textContent = hint.description
  description.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.4;
  `

  const actions = document.createElement('div')
  actions.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `

  if (hint.dismissible) {
    const dismissButton = document.createElement('button')
    dismissButton.textContent = 'Got it'
    dismissButton.style.cssText = `
      padding: 6px 12px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
    `
    dismissButton.addEventListener('click', () => {
      if (onDismiss) onDismiss()
      element.remove()
    })
    actions.appendChild(dismissButton)
  }

  element.appendChild(title)
  element.appendChild(description)
  element.appendChild(actions)

  // Add CSS animation
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .onboarding-hint {
        animation: none;
      }
    }
  `
  document.head.appendChild(style)

  return element
}