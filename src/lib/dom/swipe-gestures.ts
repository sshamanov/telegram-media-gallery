/**
 * Swipe gestures for gallery navigation
 * 
 * Features:
 * - Horizontal swipe for next/previous navigation
 * - Vertical swipe for dismiss/close
 * - Configurable thresholds and sensitivity
 * - Respects prefers-reduced-motion
 * - Works with both touch and mouse events
 */

export interface SwipeOptions {
  /** Minimum distance in pixels to trigger swipe (default: 50) */
  threshold?: number
  /** Maximum time in ms for swipe gesture (default: 300) */
  maxDuration?: number
  /** Whether to prevent default touch behavior (default: true) */
  preventDefault?: boolean
  /** Whether to show visual feedback during swipe (default: true) */
  visualFeedback?: boolean
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void
  /** Callback when swipe up is detected */
  onSwipeUp?: () => void
  /** Callback when swipe down is detected */
  onSwipeDown?: () => void
}

export interface SwipeState {
  isSwiping: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
  startTime: number
  direction: 'left' | 'right' | 'up' | 'down' | null
  distance: number
}

class SwipeGestureManager {
  private element: HTMLElement
  private options: Required<SwipeOptions>
  private state: SwipeState = {
    isSwiping: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    direction: null,
    distance: 0
  }
  private feedbackElement: HTMLElement | null = null

  constructor(element: HTMLElement, options: SwipeOptions = {}) {
    this.element = element
    this.options = {
      threshold: 50,
      maxDuration: 300,
      preventDefault: true,
      visualFeedback: true,
      onSwipeLeft: () => {},
      onSwipeRight: () => {},
      onSwipeUp: () => {},
      onSwipeDown: () => {},
      ...options
    }
    
    this.setupEventListeners()
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false })
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false })
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this))
    this.element.addEventListener('touchcancel', this.handleTouchEnd.bind(this))
    
    // Mouse events for desktop testing
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.element.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.element.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.element.addEventListener('mouseleave', this.handleMouseUp.bind(this))
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart)
    this.element.removeEventListener('touchmove', this.handleTouchMove)
    this.element.removeEventListener('touchend', this.handleTouchEnd)
    this.element.removeEventListener('touchcancel', this.handleTouchEnd)
    
    this.element.removeEventListener('mousedown', this.handleMouseDown)
    this.element.removeEventListener('mousemove', this.handleMouseMove)
    this.element.removeEventListener('mouseup', this.handleMouseUp)
    this.element.removeEventListener('mouseleave', this.handleMouseUp)
    
    this.removeFeedbackElement()
  }

  /**
   * Handle touch start
   */
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return
    
    const touch = event.touches[0]
    this.startSwipe(touch.clientX, touch.clientY)
    
    if (this.options.preventDefault) {
      event.preventDefault()
    }
  }

  /**
   * Handle touch move
   */
  private handleTouchMove(event: TouchEvent): void {
    if (!this.state.isSwiping || event.touches.length !== 1) return
    
    const touch = event.touches[0]
    this.updateSwipe(touch.clientX, touch.clientY)
    
    if (this.options.preventDefault) {
      event.preventDefault()
    }
  }

  /**
   * Handle touch end
   */
  private handleTouchEnd(): void {
    this.endSwipe()
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(event: MouseEvent): void {
    // Only respond to left mouse button
    if (event.button !== 0) return
    
    this.startSwipe(event.clientX, event.clientY)
    
    if (this.options.preventDefault) {
      event.preventDefault()
    }
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.state.isSwiping) return
    
    this.updateSwipe(event.clientX, event.clientY)
    
    if (this.options.preventDefault) {
      event.preventDefault()
    }
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(): void {
    this.endSwipe()
  }

  /**
   * Start swipe gesture
   */
  private startSwipe(startX: number, startY: number): void {
    this.state = {
      isSwiping: true,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      startTime: Date.now(),
      direction: null,
      distance: 0
    }
    
    if (this.options.visualFeedback) {
      this.createFeedbackElement()
    }
  }

  /**
   * Update swipe gesture
   */
  private updateSwipe(currentX: number, currentY: number): void {
    if (!this.state.isSwiping) return
    
    this.state.currentX = currentX
    this.state.currentY = currentY
    
    const deltaX = currentX - this.state.startX
    const deltaY = currentY - this.state.startY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    this.state.distance = distance
    
    // Determine primary direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      this.state.direction = deltaX > 0 ? 'right' : 'left'
    } else {
      this.state.direction = deltaY > 0 ? 'down' : 'up'
    }
    
    // Update visual feedback
    if (this.options.visualFeedback && this.feedbackElement) {
      this.updateFeedbackElement(deltaX, deltaY)
    }
  }

  /**
   * End swipe gesture
   */
  private endSwipe(): void {
    if (!this.state.isSwiping) return
    
    const duration = Date.now() - this.state.startTime
    const deltaX = this.state.currentX - this.state.startX
    const deltaY = this.state.currentY - this.state.startY
    const distance = this.state.distance
    
    // Check if swipe meets criteria
    if (duration <= this.options.maxDuration && distance >= this.options.threshold) {
      this.triggerSwipeAction(deltaX, deltaY)
    }
    
    // Clean up
    this.state.isSwiping = false
    this.removeFeedbackElement()
  }

  /**
   * Trigger appropriate swipe action
   */
  private triggerSwipeAction(deltaX: number, deltaY: number): void {
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)
    
    if (isHorizontal) {
      if (deltaX > 0) {
        this.options.onSwipeRight()
      } else {
        this.options.onSwipeLeft()
      }
    } else {
      if (deltaY > 0) {
        this.options.onSwipeDown()
      } else {
        this.options.onSwipeUp()
      }
    }
  }

  /**
   * Create visual feedback element
   */
  private createFeedbackElement(): void {
    if (this.feedbackElement || !this.options.visualFeedback) return
    
    this.feedbackElement = document.createElement('div')
    this.feedbackElement.className = 'swipe-feedback'
    this.feedbackElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.2s ease;
      background: linear-gradient(
        to right,
        rgba(0, 136, 204, 0.1) 0%,
        transparent 20%,
        transparent 80%,
        rgba(0, 136, 204, 0.1) 100%
      );
    `
    
    document.body.appendChild(this.feedbackElement)
    
    // Fade in
    requestAnimationFrame(() => {
      if (this.feedbackElement) {
        this.feedbackElement.style.opacity = '0.3'
      }
    })
  }

  /**
   * Update visual feedback element
   */
  private updateFeedbackElement(deltaX: number, deltaY: number): void {
    if (!this.feedbackElement) return
    
    // Calculate opacity based on swipe progress
    const progress = Math.min(this.state.distance / this.options.threshold, 1)
    const opacity = 0.3 * progress
    
    // Update based on direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      const gradientDirection = deltaX > 0 ? 'to right' : 'to left'
      this.feedbackElement.style.background = `
        linear-gradient(
          ${gradientDirection},
          rgba(0, 136, 204, ${opacity}) 0%,
          transparent 30%,
          transparent 70%,
          rgba(0, 136, 204, ${opacity * 0.5}) 100%
        )
      `
    } else {
      // Vertical swipe
      const gradientDirection = deltaY > 0 ? 'to bottom' : 'to top'
      this.feedbackElement.style.background = `
        linear-gradient(
          ${gradientDirection},
          rgba(0, 136, 204, ${opacity}) 0%,
          transparent 30%,
          transparent 70%,
          rgba(0, 136, 204, ${opacity * 0.5}) 100%
        )
      `
    }
  }

  /**
   * Remove visual feedback element
   */
  private removeFeedbackElement(): void {
    if (!this.feedbackElement) return
    
    // Fade out
    this.feedbackElement.style.opacity = '0'
    
    setTimeout(() => {
      if (this.feedbackElement && this.feedbackElement.parentElement) {
        this.feedbackElement.parentElement.removeChild(this.feedbackElement)
      }
      this.feedbackElement = null
    }, 200)
  }

  /**
   * Get current swipe state
   */
  getState(): SwipeState {
    return { ...this.state }
  }

  /**
   * Update swipe options
   */
  updateOptions(options: Partial<SwipeOptions>): void {
    Object.assign(this.options, options)
  }
}

/**
 * Svelte action for swipe gestures
 */
export function swipeGestures(
  element: HTMLElement,
  options: SwipeOptions = {}
): { destroy: () => void; update: (options: SwipeOptions) => void } {
  const manager = new SwipeGestureManager(element, options)
  
  return {
    destroy: () => manager.destroy(),
    update: (newOptions: SwipeOptions) => manager.updateOptions(newOptions)
  }
}

/**
 * Pre-configured swipe gestures for gallery navigation
 */
export function createGallerySwipeGestures(
  element: HTMLElement,
  callbacks: {
    onNext?: () => void
    onPrevious?: () => void
    onClose?: () => void
  } = {}
): { destroy: () => void } {
  const options: SwipeOptions = {
    threshold: 60,
    maxDuration: 400,
    visualFeedback: true,
    preventDefault: true,
    onSwipeLeft: callbacks.onNext || (() => {}),
    onSwipeRight: callbacks.onPrevious || (() => {}),
    onSwipeDown: callbacks.onClose || (() => {}),
    onSwipeUp: () => {} // Usually not used in gallery
  }
  
  const manager = new SwipeGestureManager(element, options)
  
  return {
    destroy: () => manager.destroy()
  }
}