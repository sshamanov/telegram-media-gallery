/**
 * Global keyboard shortcuts for Telegram Gallery
 * 
 * Features:
 * - Global shortcuts (work anywhere in the app)
 * - Context-aware shortcuts (only in specific views)
 * - Help overlay with all available shortcuts
 * - Support for modifier keys (Ctrl, Alt, Shift, Meta)
 */

export interface KeyboardShortcut {
  /** Keyboard key (e.g., 'k', 'ArrowLeft', 'Escape') */
  key: string
  /** Modifier keys required */
  modifiers?: {
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
  }
  /** Description shown in help overlay */
  description: string
  /** Context where shortcut is active (empty = global) */
  context?: 'gallery' | 'viewer' | 'dialog-list' | 'settings'
  /** Callback when shortcut is triggered */
  action: () => void
}

export interface KeyboardShortcutsState {
  /** Whether help overlay is visible */
  showHelp: boolean
  /** Registered shortcuts */
  shortcuts: KeyboardShortcut[]
  /** Active context */
  activeContext: string | null
}

class KeyboardShortcutsManager {
  private shortcuts: KeyboardShortcut[] = []
  private activeContext: string | null = null
  private showHelp = false
  private helpOverlay: HTMLElement | null = null

  constructor() {
    this.setupGlobalShortcuts()
    this.setupEventListeners()
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.push(shortcut)
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(shortcut: KeyboardShortcut): void {
    const index = this.shortcuts.findIndex(s => 
      s.key === shortcut.key && 
      JSON.stringify(s.modifiers) === JSON.stringify(shortcut.modifiers) &&
      s.context === shortcut.context
    )
    if (index >= 0) {
      this.shortcuts.splice(index, 1)
    }
  }

  /**
   * Set active context for context-aware shortcuts
   */
  setContext(context: string | null): void {
    this.activeContext = context
  }

  /**
   * Show/hide help overlay
   */
  toggleHelp(): void {
    this.showHelp = !this.showHelp
    this.updateHelpOverlay()
  }

  /**
   * Setup global shortcuts (work everywhere)
   */
  private setupGlobalShortcuts(): void {
    // Help overlay
    this.register({
      key: '?',
      description: 'Show keyboard shortcuts',
      action: () => this.toggleHelp()
    })

    // Escape key
    this.register({
      key: 'Escape',
      description: 'Close modal or clear selection',
      action: () => {
        // This will be handled by context-specific handlers
        // The actual action depends on the current context
      }
    })

    // Navigation shortcuts
    this.register({
      key: 'g',
      modifiers: { shift: true },
      description: 'Go to galleries tab',
      action: () => {
        // Would navigate to galleries tab
        console.log('Shift+G - Go to galleries')
      }
    })

    this.register({
      key: 'g',
      modifiers: { ctrl: true },
      description: 'Toggle gallery bookmark',
      context: 'gallery',
      action: () => {
        // Would toggle gallery bookmark
        console.log('Ctrl+G - Toggle gallery bookmark')
      }
    })
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Don't trigger shortcuts if user is typing in an input
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return
    }

    const { key, ctrlKey, altKey, shiftKey, metaKey } = event

    // Check for help overlay toggle first
    if (key === '?' && !ctrlKey && !altKey && !metaKey) {
      event.preventDefault()
      this.toggleHelp()
      return
    }

    // Find matching shortcut
    const shortcut = this.shortcuts.find(s => {
      // Check key
      if (s.key !== key) return false

      // Check modifiers
      if (s.modifiers) {
        if (s.modifiers.ctrl !== undefined && s.modifiers.ctrl !== ctrlKey) return false
        if (s.modifiers.alt !== undefined && s.modifiers.alt !== altKey) return false
        if (s.modifiers.shift !== undefined && s.modifiers.shift !== shiftKey) return false
        if (s.modifiers.meta !== undefined && s.modifiers.meta !== metaKey) return false
      } else {
        // No modifiers specified, require none
        if (ctrlKey || altKey || shiftKey || metaKey) return false
      }

      // Check context
      if (s.context && s.context !== this.activeContext) return false

      return true
    })

    if (shortcut) {
      event.preventDefault()
      event.stopPropagation()
      shortcut.action()
    }
  }

  /**
   * Create or update help overlay
   */
  private updateHelpOverlay(): void {
    if (this.showHelp && !this.helpOverlay) {
      this.createHelpOverlay()
    } else if (!this.showHelp && this.helpOverlay) {
      this.removeHelpOverlay()
    }
  }

  /**
   * Create help overlay element
   */
  private createHelpOverlay(): void {
    const overlay = document.createElement('div')
    overlay.className = 'keyboard-shortcuts-overlay'
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
    `

    const modal = document.createElement('div')
    modal.className = 'keyboard-shortcuts-modal'
    modal.style.cssText = `
      background: var(--background);
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
    `

    const header = document.createElement('div')
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    `

    const title = document.createElement('h2')
    title.textContent = 'Keyboard Shortcuts'
    title.style.cssText = `
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    `

    const closeButton = document.createElement('button')
    closeButton.textContent = '×'
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: var(--text);
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    `
    closeButton.addEventListener('click', () => this.toggleHelp())
    closeButton.setAttribute('aria-label', 'Close help')

    header.appendChild(title)
    header.appendChild(closeButton)

    const content = document.createElement('div')
    
    // Group shortcuts by context
    const globalShortcuts = this.shortcuts.filter(s => !s.context)
    const contextShortcuts = this.shortcuts.filter(s => s.context)
    
    if (globalShortcuts.length > 0) {
      const globalSection = this.createShortcutSection('Global Shortcuts', globalShortcuts)
      content.appendChild(globalSection)
    }

    if (contextShortcuts.length > 0) {
      const contextSection = this.createShortcutSection('Context Shortcuts', contextShortcuts)
      content.appendChild(contextSection)
    }

    const footer = document.createElement('div')
    footer.style.cssText = `
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 14px;
      color: var(--text-muted);
      text-align: center;
    `
    footer.textContent = 'Press ? to toggle this help overlay'

    modal.appendChild(header)
    modal.appendChild(content)
    modal.appendChild(footer)
    overlay.appendChild(modal)
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.toggleHelp()
      }
    })

    document.body.appendChild(overlay)
    this.helpOverlay = overlay

    // Focus the close button for accessibility
    closeButton.focus()
  }

  /**
   * Create a section of shortcuts
   */
  private createShortcutSection(title: string, shortcuts: KeyboardShortcut[]): HTMLElement {
    const section = document.createElement('div')
    section.style.marginBottom = '24px'

    const sectionTitle = document.createElement('h3')
    sectionTitle.textContent = title
    sectionTitle.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 18px;
      font-weight: 500;
    `

    const list = document.createElement('div')
    list.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    `

    shortcuts.forEach(shortcut => {
      const item = document.createElement('div')
      item.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--background-alt);
        border-radius: 6px;
        border: 1px solid var(--border);
      `

      const keys = document.createElement('div')
      keys.style.cssText = `
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 14px;
        color: var(--accent);
      `
      
      const keyParts = []
      if (shortcut.modifiers?.ctrl) keyParts.push('Ctrl')
      if (shortcut.modifiers?.alt) keyParts.push('Alt')
      if (shortcut.modifiers?.shift) keyParts.push('Shift')
      if (shortcut.modifiers?.meta) keyParts.push('⌘')
      keyParts.push(shortcut.key)
      
      keys.textContent = keyParts.join(' + ')

      const desc = document.createElement('div')
      desc.textContent = shortcut.description
      desc.style.cssText = `
        font-size: 14px;
        color: var(--text);
      `

      item.appendChild(keys)
      item.appendChild(desc)
      list.appendChild(item)
    })

    section.appendChild(sectionTitle)
    section.appendChild(list)
    return section
  }

  /**
   * Remove help overlay
   */
  private removeHelpOverlay(): void {
    if (this.helpOverlay) {
      document.body.removeChild(this.helpOverlay)
      this.helpOverlay = null
    }
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this))
    this.removeHelpOverlay()
  }
}

// Singleton instance
let instance: KeyboardShortcutsManager | null = null

export function getKeyboardShortcutsManager(): KeyboardShortcutsManager {
  if (!instance) {
    instance = new KeyboardShortcutsManager()
  }
  return instance
}

/**
 * Svelte action for keyboard shortcuts
 */
export function keyboardShortcuts(
  _element: HTMLElement,
  options: {
    shortcuts?: KeyboardShortcut[]
    context?: string
  }
): { destroy: () => void } {
  const manager = getKeyboardShortcutsManager()
  
  // Set context
  if (options.context) {
    manager.setContext(options.context)
  }

  // Register shortcuts
  if (options.shortcuts) {
    options.shortcuts.forEach(shortcut => manager.register(shortcut))
  }

  return {
    destroy: () => {
      // Unregister shortcuts
      if (options.shortcuts) {
        options.shortcuts.forEach(shortcut => manager.unregister(shortcut))
      }
      // Clear context if this element was setting it
      if (options.context && manager['activeContext'] === options.context) {
        manager.setContext(null)
      }
    }
  }
}