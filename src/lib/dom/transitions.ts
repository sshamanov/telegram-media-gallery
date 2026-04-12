/**
 * Minimal animated transitions respecting prefers-reduced-motion
 * 
 * Features:
 * - 150ms cross-fade transitions for route changes
 * - Respects prefers-reduced-motion
 * - Simple API for common transitions
 */

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Get transition duration based on user preference
 * @param defaultDuration Default duration in ms (default: 150)
 * @returns Duration in ms (0 if prefers-reduced-motion)
 */
export function getTransitionDuration(defaultDuration = 150): number {
  return prefersReducedMotion() ? 0 : defaultDuration
}

/**
 * Apply cross-fade transition between elements
 * @param outgoing Element to fade out
 * @param incoming Element to fade in
 * @param options Transition options
 */
export function crossFade(
  outgoing: HTMLElement,
  incoming: HTMLElement,
  options: {
    duration?: number
    onComplete?: () => void
  } = {}
): void {
  const duration = getTransitionDuration(options.duration)
  
  if (duration === 0) {
    // No transition, just swap
    outgoing.style.display = 'none'
    incoming.style.display = ''
    options.onComplete?.()
    return
  }
  
  // Set initial states
  outgoing.style.transition = `opacity ${duration}ms ease`
  incoming.style.transition = `opacity ${duration}ms ease`
  incoming.style.opacity = '0'
  incoming.style.display = ''
  
  // Force reflow
  incoming.getBoundingClientRect()
  
  // Start transition
  outgoing.style.opacity = '0'
  incoming.style.opacity = '1'
  
  // Clean up after transition
  setTimeout(() => {
    outgoing.style.display = 'none'
    outgoing.style.opacity = ''
    outgoing.style.transition = ''
    incoming.style.opacity = ''
    incoming.style.transition = ''
    options.onComplete?.()
  }, duration)
}

/**
 * Slide transition for modals and sheets
 * @param element Element to animate
 * @param direction Slide direction
 * @param options Transition options
 */
export function slide(
  element: HTMLElement,
  direction: 'in' | 'out',
  options: {
    from?: 'top' | 'bottom' | 'left' | 'right'
    duration?: number
    onComplete?: () => void
  } = {}
): void {
  const duration = getTransitionDuration(options.duration)
  const from = options.from || 'bottom'
  
  if (duration === 0) {
    // No transition
    if (direction === 'in') {
      element.style.transform = ''
      element.style.opacity = '1'
    } else {
      element.style.transform = ''
      element.style.opacity = '0'
    }
    options.onComplete?.()
    return
  }
  
  // Set up transform based on direction
  let transformIn = ''
  let transformOut = ''
  
  switch (from) {
    case 'top':
      transformIn = 'translateY(0)'
      transformOut = 'translateY(-100%)'
      break
    case 'bottom':
      transformIn = 'translateY(0)'
      transformOut = 'translateY(100%)'
      break
    case 'left':
      transformIn = 'translateX(0)'
      transformOut = 'translateX(-100%)'
      break
    case 'right':
      transformIn = 'translateX(0)'
      transformOut = 'translateX(100%)'
      break
  }
  
  // Apply transition
  element.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`
  
  if (direction === 'in') {
    element.style.opacity = '0'
    element.style.transform = transformOut
    element.style.display = ''
    
    // Force reflow
    element.getBoundingClientRect()
    
    element.style.opacity = '1'
    element.style.transform = transformIn
  } else {
    element.style.opacity = '0'
    element.style.transform = transformOut
  }
  
  // Clean up after transition
  setTimeout(() => {
    if (direction === 'out') {
      element.style.display = 'none'
    }
    element.style.transform = ''
    element.style.opacity = ''
    element.style.transition = ''
    options.onComplete?.()
  }, duration)
}

/**
 * Fade transition for overlays and backdrops
 * @param element Element to animate
 * @param direction Fade direction
 * @param options Transition options
 */
export function fade(
  element: HTMLElement,
  direction: 'in' | 'out',
  options: {
    duration?: number
    onComplete?: () => void
  } = {}
): void {
  const duration = getTransitionDuration(options.duration)
  
  if (duration === 0) {
    // No transition
    element.style.opacity = direction === 'in' ? '1' : '0'
    if (direction === 'out') {
      element.style.display = 'none'
    }
    options.onComplete?.()
    return
  }
  
  // Apply transition
  element.style.transition = `opacity ${duration}ms ease`
  
  if (direction === 'in') {
    element.style.opacity = '0'
    element.style.display = ''
    
    // Force reflow
    element.getBoundingClientRect()
    
    element.style.opacity = '1'
  } else {
    element.style.opacity = '0'
  }
  
  // Clean up after transition
  setTimeout(() => {
    if (direction === 'out') {
      element.style.display = 'none'
    }
    element.style.opacity = ''
    element.style.transition = ''
    options.onComplete?.()
  }, duration)
}

/**
 * Svelte action for route transitions
 */
export function routeTransition(
  element: HTMLElement
): { destroy: () => void } {
  const duration = getTransitionDuration(150)
  
  if (duration === 0) {
    return { destroy: () => {} }
  }
  
  // Apply initial state
  element.style.opacity = '0'
  element.style.transition = `opacity ${duration}ms ease`
  
  // Force reflow
  element.getBoundingClientRect()
  
  // Fade in
  element.style.opacity = '1'
  
  // Clean up after transition
  const timeout = setTimeout(() => {
    element.style.opacity = ''
    element.style.transition = ''
  }, duration)
  
  return {
    destroy: () => {
      clearTimeout(timeout)
      element.style.opacity = ''
      element.style.transition = ''
    }
  }
}