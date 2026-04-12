/**
 * Tooltip system for icon buttons
 * 
 * Features:
 * - Shows tooltips on hover (desktop)
 * - Shows tooltips on long-press (mobile)
 * - Respects prefers-reduced-motion
 * - Accessible via aria-label
 */

export interface TooltipOptions {
  /** Tooltip text (should match aria-label) */
  text: string
  /** Position relative to element */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Delay before showing tooltip (ms) */
  delay?: number
  /** Whether to show on mobile (default: true) */
  mobile?: boolean
}

class TooltipManager {
  private tooltip: HTMLElement | null = null
  private hoverTimer: ReturnType<typeof setTimeout> | null = null
  private longPressTimer: ReturnType<typeof setTimeout> | null = null
  private currentTarget: HTMLElement | null = null
  private isMobile = false

  constructor() {
    this.isMobile = this.detectMobile()
    this.createTooltipElement()
  }

  /**
   * Detect if device is mobile/touch
   */
  private detectMobile(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  /**
   * Create tooltip element
   */
  private createTooltipElement(): void {
    this.tooltip = document.createElement('div')
    this.tooltip.className = 'icon-tooltip'
    this.tooltip.style.cssText = `
      position: absolute;
      background: var(--bg-overlay);
      color: var(--text-primary);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `
    document.body.appendChild(this.tooltip)
  }

  /**
   * Show tooltip for an element
   */
  show(element: HTMLElement, options: TooltipOptions): void {
    if (!this.tooltip) return

    this.currentTarget = element
    this.tooltip.textContent = options.text

    // Position tooltip
    const rect = element.getBoundingClientRect()
    const position = options.position || 'top'
    
    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = rect.top - this.tooltip.offsetHeight - 8
        left = rect.left + rect.width / 2 - this.tooltip.offsetWidth / 2
        break
      case 'bottom':
        top = rect.bottom + 8
        left = rect.left + rect.width / 2 - this.tooltip.offsetWidth / 2
        break
      case 'left':
        top = rect.top + rect.height / 2 - this.tooltip.offsetHeight / 2
        left = rect.left - this.tooltip.offsetWidth - 8
        break
      case 'right':
        top = rect.top + rect.height / 2 - this.tooltip.offsetHeight / 2
        left = rect.right + 8
        break
    }

    // Ensure tooltip stays within viewport
    const viewportPadding = 8
    if (top < viewportPadding) top = viewportPadding
    if (top + this.tooltip.offsetHeight > window.innerHeight - viewportPadding) {
      top = window.innerHeight - this.tooltip.offsetHeight - viewportPadding
    }
    if (left < viewportPadding) left = viewportPadding
    if (left + this.tooltip.offsetWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - this.tooltip.offsetWidth - viewportPadding
    }

    this.tooltip.style.top = `${top}px`
    this.tooltip.style.left = `${left}px`

    // Show tooltip
    requestAnimationFrame(() => {
      if (this.tooltip) {
        this.tooltip.style.opacity = '1'
        this.tooltip.style.transform = 'translateY(0)'
      }
    })
  }

  /**
   * Hide tooltip
   */
  hide(): void {
    if (!this.tooltip) return

    this.tooltip.style.opacity = '0'
    this.tooltip.style.transform = 'translateY(4px)'
    
    this.currentTarget = null
    
    // Clear timers
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer)
      this.hoverTimer = null
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  /**
   * Setup tooltip for an element
   */
  setup(element: HTMLElement, options: TooltipOptions): () => void {
    const { delay = 400, mobile = true } = options
    
    // Get aria-label as fallback text
    const ariaLabel = element.getAttribute('aria-label')
    const tooltipText = options.text || ariaLabel || ''
    
    if (!tooltipText) {
      return () => {} // No cleanup needed
    }

    const handleMouseEnter = () => {
      if (this.isMobile && !mobile) return
      
      this.hoverTimer = setTimeout(() => {
        this.show(element, { ...options, text: tooltipText })
      }, delay)
    }

    const handleMouseLeave = () => {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = null
      }
      this.hide()
    }

    const handleTouchStart = () => {
      if (!mobile) return
      
      this.longPressTimer = setTimeout(() => {
        this.show(element, { ...options, text: tooltipText })
      }, 500) // Longer delay for long-press
    }

    const handleTouchEnd = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }
      this.hide()
    }

    const handleTouchMove = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }
    }

    // Add event listeners
    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('touchstart', handleTouchStart)
    element.addEventListener('touchend', handleTouchEnd)
    element.addEventListener('touchmove', handleTouchMove)

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchmove', handleTouchMove)
      
      if (this.currentTarget === element) {
        this.hide()
      }
    }
  }

  /**
   * Clean up tooltip manager
   */
  destroy(): void {
    if (this.tooltip && this.tooltip.parentElement) {
      document.body.removeChild(this.tooltip)
    }
    this.tooltip = null
    
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer)
      this.hoverTimer = null
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }
}

// Singleton instance
let instance: TooltipManager | null = null

export function getTooltipManager(): TooltipManager {
  if (!instance) {
    instance = new TooltipManager()
  }
  return instance
}

/**
 * Svelte action for tooltips
 */
export function tooltip(
  element: HTMLElement,
  options: TooltipOptions
): { destroy: () => void } {
  const manager = getTooltipManager()
  const cleanup = manager.setup(element, options)
  
  return {
    destroy: cleanup
  }
}