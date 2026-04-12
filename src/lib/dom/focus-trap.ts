/**
 * Focus trap utility for modal dialogs
 * 
 * Implements WCAG 2.1 focus trapping:
 * - Traps focus within the modal
 * - Returns focus to trigger element when modal closes
 * - Handles Escape key to close modal
 * - Manages aria-hidden on other page content
 */

export interface FocusTrapOptions {
  /** Element that triggered the modal (for returning focus) */
  triggerElement?: HTMLElement | null
  /** Callback when Escape is pressed */
  onEscape?: () => void
  /** Whether to hide other content from screen readers (default: true) */
  hideOtherContent?: boolean
}

/**
 * Trap focus within a modal element
 */
export function trapFocus(element: HTMLElement, options: FocusTrapOptions = {}): () => void {
  const {
    triggerElement = null,
    onEscape,
    hideOtherContent = true
  } = options

  // Store previously focused element
  const previousActiveElement = document.activeElement as HTMLElement | null

  // Get all focusable elements within the modal
  const focusableElements = getFocusableElements(element)
  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]

  // Hide other content from screen readers if requested
  let hiddenElements: HTMLElement[] = []
  if (hideOtherContent && element.parentElement) {
    hiddenElements = hideOtherContentFromScreenReaders(element.parentElement, element)
  }

  // Focus the first element
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 10)
  } else {
    // If no focusable elements, focus the modal itself
    element.setAttribute('tabindex', '-1')
    element.focus()
  }

  // Handle tab key navigation
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      // Shift + Tab
      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault()
          lastFocusable.focus()
        }
      } 
      // Tab
      else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault()
          firstFocusable.focus()
        }
      }
    }
    
    // Escape key closes modal
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      event.stopPropagation()
      onEscape()
    }
  }

  // Handle focus events
  const handleFocus = (event: FocusEvent) => {
    const target = event.target as HTMLElement
    
    // If focus leaves the modal, bring it back
    if (!element.contains(target)) {
      event.preventDefault()
      if (firstFocusable) {
        firstFocusable.focus()
      } else {
        element.focus()
      }
    }
  }

  // Add event listeners
  element.addEventListener('keydown', handleKeyDown)
  document.addEventListener('focusin', handleFocus, true)

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('focusin', handleFocus, true)
    
    // Restore aria-hidden attributes
    hiddenElements.forEach(el => {
      el.removeAttribute('aria-hidden')
    })
    
    // Return focus to trigger element or previously focused element
    const elementToFocus = triggerElement || previousActiveElement
    if (elementToFocus && elementToFocus.focus) {
      setTimeout(() => elementToFocus.focus(), 10)
    }
  }
}

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'details',
    'summary'
  ].join(', ')
  
  const elements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[]
  
  // Filter out hidden elements
  return elements.filter(el => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           !el.hasAttribute('disabled') &&
           !el.hasAttribute('aria-hidden')
  })
}

/**
 * Hide all other content from screen readers except the modal
 */
function hideOtherContentFromScreenReaders(
  parent: HTMLElement,
  excludeElement: HTMLElement
): HTMLElement[] {
  const children = Array.from(parent.children) as HTMLElement[]
  const hiddenElements: HTMLElement[] = []
  
  children.forEach(child => {
    if (child !== excludeElement && !child.contains(excludeElement)) {
      const currentAriaHidden = child.getAttribute('aria-hidden')
      if (currentAriaHidden !== 'true') {
        child.setAttribute('aria-hidden', 'true')
        hiddenElements.push(child)
      }
    }
  })
  
  return hiddenElements
}

/**
 * Simple focus trap for Svelte components
 * Use in onMount: `onMount(() => trapFocus(element, { onEscape: closeModal }))`
 */
export function useFocusTrap(
  element: HTMLElement,
  options: FocusTrapOptions = {}
): { destroy: () => void } {
  const cleanup = trapFocus(element, options)
  
  return {
    destroy: cleanup
  }
}