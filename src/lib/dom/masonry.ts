/**
 * Masonry layout with auto-detection for Telegram Gallery
 * 
 * Features:
 * - Auto-detects when to use masonry layout (≥90% visual content)
 * - Responsive column count based on container width
 * - Smooth transitions between grid and masonry
 * - Respects prefers-reduced-motion
 */

export interface MasonryOptions {
  /** Minimum percentage of visual items to trigger masonry (0-100) */
  visualThreshold?: number
  /** Gap between items in pixels */
  gap?: number
  /** Minimum column width in pixels */
  minColumnWidth?: number
  /** Maximum number of columns */
  maxColumns?: number
  /** Whether to animate transitions */
  animate?: boolean
}

export interface MasonryItem {
  /** Unique identifier */
  id: string
  /** Item width in pixels */
  width: number
  /** Item height in pixels */
  height: number
  /** Whether item is visual content (photo/video) */
  isVisual: boolean
  /** DOM element (optional, for direct manipulation) */
  element?: HTMLElement
}

export interface MasonryLayout {
  /** Column positions for each item */
  positions: Array<{ x: number; y: number; column: number }>
  /** Total height of the masonry layout */
  totalHeight: number
  /** Number of columns used */
  columns: number
  /** Column heights */
  columnHeights: number[]
}

class MasonryManager {
  private container: HTMLElement | null = null
  private items: MasonryItem[] = []
  private options: Required<MasonryOptions>
  private resizeObserver: ResizeObserver | null = null
  private mutationObserver: MutationObserver | null = null

  constructor(options: MasonryOptions = {}) {
    this.options = {
      visualThreshold: 90,
      gap: 16,
      minColumnWidth: 200,
      maxColumns: 6,
      animate: true,
      ...options
    }
  }

  /**
   * Initialize masonry on a container
   */
  init(container: HTMLElement): void {
    this.container = container
    this.setupObservers()
    this.updateLayout()
  }

  /**
   * Clean up masonry
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }
    
    this.container = null
    this.items = []
  }

  /**
   * Set up observers for container changes
   */
  private setupObservers(): void {
    if (!this.container) return

    // Observe container size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.updateLayout()
    })
    this.resizeObserver.observe(this.container)

    // Observe DOM changes for dynamic content
    this.mutationObserver = new MutationObserver(() => {
      this.updateItemsFromDOM()
      this.updateLayout()
    })
    this.mutationObserver.observe(this.container, {
      childList: true,
      subtree: true
    })
  }

  /**
   * Update items from DOM elements
   */
  private updateItemsFromDOM(): void {
    if (!this.container) return

    this.items = []
    const itemElements = this.container.querySelectorAll('[data-masonry-item]')
    
    itemElements.forEach((element, _index) => {
      if (!(element instanceof HTMLElement)) return
      
      const rect = element.getBoundingClientRect()
      const isVisual = element.hasAttribute('data-visual-content')
      
      this.items.push({
        id: element.id || `item-${_index}`,
        width: rect.width,
        height: rect.height,
        isVisual,
        element
      })
    })
  }

  /**
   * Check if masonry layout should be used
   */
  shouldUseMasonry(): boolean {
    if (this.items.length === 0) return false
    
    const visualCount = this.items.filter(item => item.isVisual).length
    const visualPercentage = (visualCount / this.items.length) * 100
    
    return visualPercentage >= this.options.visualThreshold
  }

  /**
   * Calculate optimal number of columns
   */
  private calculateColumns(): number {
    if (!this.container) return 1
    
    const containerWidth = this.container.clientWidth
    const availableWidth = containerWidth - (this.options.gap * 2)
    
    // Calculate based on minimum column width
    const columnsByWidth = Math.floor(availableWidth / this.options.minColumnWidth)
    
    // Limit by max columns
    const columns = Math.min(
      Math.max(1, columnsByWidth),
      this.options.maxColumns
    )
    
    return columns
  }

  /**
   * Calculate masonry layout
   */
  calculateLayout(): MasonryLayout | null {
    if (!this.shouldUseMasonry() || this.items.length === 0) {
      return null
    }

    const columns = this.calculateColumns()
    const columnHeights = new Array(columns).fill(0)
    const positions: Array<{ x: number; y: number; column: number }> = []
    
    // Calculate item positions
    this.items.forEach((item) => {
      // Find shortest column
      let shortestColumn = 0
      let shortestHeight = columnHeights[0]
      
      for (let i = 1; i < columns; i++) {
        if (columnHeights[i] < shortestHeight) {
          shortestColumn = i
          shortestHeight = columnHeights[i]
        }
      }
      
      // Calculate position
      const x = shortestColumn * (item.width + this.options.gap)
      const y = shortestHeight
      
      positions.push({
        x,
        y,
        column: shortestColumn
      })
      
      // Update column height
      columnHeights[shortestColumn] = y + item.height + this.options.gap
    })
    
    // Calculate total height
    const totalHeight = Math.max(...columnHeights)
    
    return {
      positions,
      totalHeight,
      columns,
      columnHeights
    }
  }

  /**
   * Apply masonry layout to DOM
   */
  applyLayout(layout: MasonryLayout | null): void {
    if (!this.container) return
    
    if (!layout) {
      // Reset to grid layout
      this.container.style.position = 'relative'
      this.container.style.height = 'auto'
      
      this.items.forEach((item) => {
        if (item.element) {
          item.element.style.position = 'static'
          item.element.style.transform = 'none'
          item.element.style.transition = this.options.animate && !this.prefersReducedMotion()
            ? 'transform 0.3s ease'
            : 'none'
        }
      })
      
      return
    }
    
    // Apply masonry layout
    this.container.style.position = 'relative'
    this.container.style.height = `${layout.totalHeight}px`
    
    this.items.forEach((item, index) => {
      if (!item.element) return
      
      const position = layout.positions[index]
      if (!position) return
      
      item.element.style.position = 'absolute'
      item.element.style.transform = `translate(${position.x}px, ${position.y}px)`
      item.element.style.transition = this.options.animate && !this.prefersReducedMotion()
        ? 'transform 0.3s ease'
        : 'none'
      item.element.style.width = `${item.width}px`
      item.element.style.height = `${item.height}px`
    })
  }

  /**
   * Update layout based on current state
   */
  updateLayout(): void {
    this.updateItemsFromDOM()
    const layout = this.calculateLayout()
    this.applyLayout(layout)
  }

  /**
   * Check if user prefers reduced motion
   */
  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /**
   * Get current layout information
   */
  getLayoutInfo(): {
    isMasonry: boolean
    columns: number
    totalHeight: number
    itemCount: number
    visualPercentage: number
  } {
    const layout = this.calculateLayout()
    const visualCount = this.items.filter(item => item.isVisual).length
    const visualPercentage = this.items.length > 0
      ? (visualCount / this.items.length) * 100
      : 0
    
    return {
      isMasonry: layout !== null,
      columns: layout?.columns || 1,
      totalHeight: layout?.totalHeight || 0,
      itemCount: this.items.length,
      visualPercentage
    }
  }
}

/**
 * Svelte action for masonry layout
 */
export function masonry(
  element: HTMLElement,
  options: MasonryOptions & { enabled?: boolean } = {}
): { destroy: () => void; update: (options: MasonryOptions & { enabled?: boolean }) => void } {
  const { enabled = true, ...masonryOptions } = options
  const manager = new MasonryManager(masonryOptions)
  
  if (enabled) {
    manager.init(element)
  }
  
  return {
    destroy: () => manager.destroy(),
    update: (newOptions: MasonryOptions & { enabled?: boolean }) => {
      const { enabled: newEnabled = true, ...newMasonryOptions } = newOptions
      
      if (newEnabled && !enabled) {
        // Enable masonry
        Object.assign(manager, new MasonryManager(newMasonryOptions))
        manager.init(element)
      } else if (!newEnabled && enabled) {
        // Disable masonry
        manager.destroy()
      } else if (enabled) {
        // Update options
        manager.destroy()
        Object.assign(manager, new MasonryManager(newMasonryOptions))
        manager.init(element)
      }
    }
  }
}

/**
 * Utility to check if media item is visual content
 */
export function isVisualContent(item: any): boolean {
  if (!item || !item.type) return false
  
  const visualTypes = [
    'photo',
    'video',
    'document-video',
    'large-video',
    'document-image'
  ]
  
  return visualTypes.includes(item.type)
}

/**
 * Auto-detection helper for gallery components
 */
export function shouldUseMasonryLayout(items: any[]): boolean {
  if (items.length === 0) return false
  
  const visualCount = items.filter(item => isVisualContent(item)).length
  const visualPercentage = (visualCount / items.length) * 100
  
  return visualPercentage >= 90
}