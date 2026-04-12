/**
 * Pull-to-refresh implementation for mobile touch devices
 * 
 * Features:
 * - Touch gesture detection with overscroll
 * - Visual feedback (pull indicator, spinner)
 * - Triggers refresh callback on release
 * - Respects `prefers-reduced-motion`
 */

export interface PullToRefreshOptions {
  /** Callback when refresh is triggered */
  onRefresh: () => void | Promise<void>
  /** Maximum pull distance in pixels (default: 120) */
  maxPullDistance?: number
  /** Distance required to trigger refresh (default: 80) */
  refreshThreshold?: number
  /** Whether to show visual feedback (default: true) */
  visualFeedback?: boolean
  /** CSS selector for the pull indicator element */
  indicatorSelector?: string
}

export interface PullToRefreshState {
  isPulling: boolean
  pullDistance: number
  isRefreshing: boolean
}

/**
 * Initialize pull-to-refresh on an element
 */
export function initPullToRefresh(
  element: HTMLElement,
  options: PullToRefreshOptions
): () => void {
  const {
    onRefresh,
    maxPullDistance = 120,
    refreshThreshold = 80,
    visualFeedback = true,
    indicatorSelector = '.pull-to-refresh-indicator'
  } = options

  let startY = 0
  let currentY = 0
  let isPulling = false
  let isRefreshing = false
  let pullDistance = 0
  
  // Create indicator if it doesn't exist
  let indicator: HTMLElement | null = null
  if (visualFeedback) {
    indicator = createIndicator(element, indicatorSelector)
  }

  const handleTouchStart = (event: TouchEvent) => {
    // Only respond to single touch
    if (event.touches.length !== 1) return
    
    // Only respond at the top of the scrollable area
    if (element.scrollTop > 10) return
    
    // Don't start if already refreshing
    if (isRefreshing) return
    
    startY = event.touches[0].clientY
    currentY = startY
    isPulling = true
    
    // Prevent default to avoid scrolling the page
    event.preventDefault()
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (!isPulling || event.touches.length !== 1) return
    
    currentY = event.touches[0].clientY
    pullDistance = Math.max(0, currentY - startY)
    
    // Apply resistance (easing) after threshold
    if (pullDistance > maxPullDistance) {
      pullDistance = maxPullDistance + (pullDistance - maxPullDistance) * 0.3
    }
    
    // Update visual feedback
    if (indicator && visualFeedback) {
      updateIndicator(indicator, pullDistance, refreshThreshold, maxPullDistance)
    }
    
    // Prevent default to avoid scrolling the page
    if (pullDistance > 0) {
      event.preventDefault()
    }
  }

  const handleTouchEnd = async () => {
    if (!isPulling) return
    
    isPulling = false
    
    // Check if we should trigger refresh
    if (pullDistance >= refreshThreshold && !isRefreshing) {
      isRefreshing = true
      
      // Show refreshing state
      if (indicator && visualFeedback) {
        indicator.classList.add('refreshing')
      }
      
      try {
        await onRefresh()
      } finally {
        isRefreshing = false
        
        // Hide indicator with animation
        if (indicator && visualFeedback) {
          indicator.classList.remove('refreshing')
          indicator.classList.add('hiding')
          setTimeout(() => {
            indicator?.classList.remove('hiding')
            resetIndicator(indicator)
          }, 300)
        }
      }
    } else {
      // Not enough pull, animate back
      if (indicator && visualFeedback) {
        indicator.classList.add('hiding')
        setTimeout(() => {
          indicator?.classList.remove('hiding')
          resetIndicator(indicator)
        }, 300)
      }
    }
    
    pullDistance = 0
  }

  // Add event listeners
  element.addEventListener('touchstart', handleTouchStart, { passive: false })
  element.addEventListener('touchmove', handleTouchMove, { passive: false })
  element.addEventListener('touchend', handleTouchEnd)
  element.addEventListener('touchcancel', handleTouchEnd)

  // Return cleanup function
  return () => {
    element.removeEventListener('touchstart', handleTouchStart)
    element.removeEventListener('touchmove', handleTouchMove)
    element.removeEventListener('touchend', handleTouchEnd)
    element.removeEventListener('touchcancel', handleTouchEnd)
    
    // Remove indicator if we created it
    if (indicator && indicator.parentElement === element) {
      element.removeChild(indicator)
    }
  }
}

/**
 * Create pull-to-refresh indicator
 */
function createIndicator(container: HTMLElement, selector: string): HTMLElement {
  // Check if indicator already exists
  let indicator = container.querySelector(selector) as HTMLElement
  if (indicator) return indicator
  
  // Create new indicator
  indicator = document.createElement('div')
  indicator.className = 'pull-to-refresh-indicator'
  indicator.innerHTML = `
    <div class="pull-icon">↓</div>
    <div class="pull-text">Pull to refresh</div>
    <div class="refresh-spinner" hidden>↻</div>
  `
  indicator.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transform: translateY(-100%);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 1000;
    pointer-events: none;
  `
  
  // Add styles for child elements
  const style = document.createElement('style')
  style.textContent = `
    .pull-to-refresh-indicator .pull-icon {
      font-size: 24px;
      transition: transform 0.3s ease;
      margin-bottom: 4px;
    }
    .pull-to-refresh-indicator .pull-text {
      font-size: 14px;
      opacity: 0.7;
    }
    .pull-to-refresh-indicator .refresh-spinner {
      font-size: 24px;
      animation: spin 1s linear infinite;
    }
    .pull-to-refresh-indicator.refreshing .pull-icon,
    .pull-to-refresh-indicator.refreshing .pull-text {
      display: none;
    }
    .pull-to-refresh-indicator.refreshing .refresh-spinner {
      display: block;
    }
    .pull-to-refresh-indicator.hiding {
      transition: transform 0.3s ease;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pull-to-refresh-indicator,
      .pull-to-refresh-indicator.hiding {
        transition: none;
      }
      .pull-to-refresh-indicator .refresh-spinner {
        animation: none;
      }
    }
  `
  document.head.appendChild(style)
  
  container.appendChild(indicator)
  return indicator
}

/**
 * Update indicator based on pull distance
 */
function updateIndicator(
  indicator: HTMLElement,
  distance: number,
  threshold: number,
  maxDistance: number
): void {
  // Calculate progress (0 to 1)
  const progress = Math.min(distance / threshold, 1)
  
  // Update transform
  const translateY = Math.min(distance, maxDistance) - 60
  indicator.style.transform = `translateY(${translateY}px)`
  
  // Rotate arrow based on progress
  const arrow = indicator.querySelector('.pull-icon') as HTMLElement
  if (arrow) {
    const rotation = progress >= 1 ? 180 : progress * 180
    arrow.style.transform = `rotate(${rotation}deg)`
  }
  
  // Update text
  const text = indicator.querySelector('.pull-text') as HTMLElement
  if (text) {
    text.textContent = progress >= 1 ? 'Release to refresh' : 'Pull to refresh'
  }
}

/**
 * Reset indicator to initial state
 */
function resetIndicator(indicator: HTMLElement): void {
  indicator.style.transform = 'translateY(-100%)'
  const arrow = indicator.querySelector('.pull-icon') as HTMLElement
  if (arrow) {
    arrow.style.transform = 'rotate(0deg)'
  }
  const text = indicator.querySelector('.pull-text') as HTMLElement
  if (text) {
    text.textContent = 'Pull to refresh'
  }
}

/**
 * Simple Svelte action for pull-to-refresh
 */
export function pullToRefresh(
  element: HTMLElement,
  options: PullToRefreshOptions
): { destroy: () => void } {
  const cleanup = initPullToRefresh(element, options)
  
  return {
    destroy: cleanup
  }
}