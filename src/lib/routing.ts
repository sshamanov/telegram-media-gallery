/**
 * Hash-based URL routing for Telegram Gallery
 * 
 * Routes:
 * - #/ - Dialog list (default)
 * - #/gallery/:dialogId - Gallery view for specific dialog
 * - #/settings - Settings screen
 * 
 * Features:
 * - Browser history support (back/forward buttons)
 * - Programmatic navigation
 * - Route change events
 * - Integration with existing app state
 */

export type Route = 
  | { type: 'dialog-list' }
  | { type: 'gallery'; dialogId: string }
  | { type: 'settings' }

export interface RouterState {
  currentRoute: Route
  previousRoute: Route | null
}

export interface RouterOptions {
  /** Whether to update browser history (default: true) */
  updateHistory?: boolean
  /** Whether to scroll to top on route change (default: true) */
  scrollToTop?: boolean
}

class Router {
  private currentRoute: Route = { type: 'dialog-list' }
  private previousRoute: Route | null = null
  private listeners: Array<(route: Route) => void> = []
  private isInitialized = false
  private boundHandleHashChange: (event: HashChangeEvent) => void

  constructor() {
    // Initialize from current URL hash
    this.parseHash(window.location.hash)
    // Bind the handler once and store it
    this.boundHandleHashChange = this.handleHashChange.bind(this)
  }

  /**
   * Initialize router and start listening to hash changes
   */
  init(): void {
    if (this.isInitialized) return
    
    window.addEventListener('hashchange', this.boundHandleHashChange)
    this.isInitialized = true
    
    // Trigger initial route
    this.notifyListeners()
  }

  /**
   * Clean up router
   */
  destroy(): void {
    window.removeEventListener('hashchange', this.boundHandleHashChange)
    this.listeners = []
    this.isInitialized = false
  }

  /**
   * Parse hash fragment into route
   */
  private parseHash(hash: string): void {
    // Remove leading # if present
    const path = hash.startsWith('#') ? hash.slice(1) : hash
    
    // Parse route
    if (path.startsWith('/gallery/')) {
      const dialogId = path.slice('/gallery/'.length)
      if (dialogId) {
        this.previousRoute = this.currentRoute
        this.currentRoute = { type: 'gallery', dialogId }
        return
      }
    } else if (path === '/settings') {
      this.previousRoute = this.currentRoute
      this.currentRoute = { type: 'settings' }
      return
    }
    
    // Default route
    this.previousRoute = this.currentRoute
    this.currentRoute = { type: 'dialog-list' }
  }

  /**
   * Handle hash change events
   */
  private handleHashChange(_event: HashChangeEvent): void {
    this.parseHash(window.location.hash)
    this.notifyListeners()
  }

  /**
   * Notify all listeners of route change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentRoute)
    }
  }

  /**
   * Navigate to a route
   */
  navigate(route: Route, options: RouterOptions = {}): void {
    const { updateHistory = true, scrollToTop = true } = options
    
    // Build hash from route
    let hash = '#'
    switch (route.type) {
      case 'gallery':
        hash += `/gallery/${route.dialogId}`
        break
      case 'settings':
        hash += '/settings'
        break
      case 'dialog-list':
        hash += '/'
        break
    }
    
    // Update URL
    if (updateHistory) {
      window.history.pushState({}, '', hash)
    } else {
      window.history.replaceState({}, '', hash)
    }
    
    // Parse and update route
    this.parseHash(hash)
    
    // Scroll to top if requested
    if (scrollToTop) {
      window.scrollTo(0, 0)
    }
    
    // Notify listeners
    this.notifyListeners()
  }

  /**
   * Navigate back to previous route
   */
  back(): void {
    window.history.back()
  }

  /**
   * Get current route
   */
  getCurrentRoute(): Route {
    return this.currentRoute
  }

  /**
   * Get previous route
   */
  getPreviousRoute(): Route | null {
    return this.previousRoute
  }

  /**
   * Check if current route matches a specific route
   */
  isRoute(route: Route): boolean {
    if (this.currentRoute.type !== route.type) return false
    
    switch (route.type) {
      case 'gallery':
        return this.currentRoute.type === 'gallery' && 
               this.currentRoute.dialogId === route.dialogId
      default:
        return true
    }
  }

  /**
   * Add route change listener
   */
  addListener(listener: (route: Route) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index >= 0) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Generate URL for a route
   */
  getUrl(route: Route): string {
    let path = '#'
    switch (route.type) {
      case 'gallery':
        path += `/gallery/${route.dialogId}`
        break
      case 'settings':
        path += '/settings'
        break
      case 'dialog-list':
        path += '/'
        break
    }
    return path
  }
}

// Singleton instance
let instance: Router | null = null

export function getRouter(): Router {
  if (!instance) {
    instance = new Router()
  }
  return instance
}

/**
 * Svelte store for router state
 */
import { writable } from 'svelte/store'

export function createRouterStore() {
  const router = getRouter()
  const { subscribe, set } = writable<Route>(router.getCurrentRoute())
  
  // Subscribe to router changes
  const unsubscribe = router.addListener((route) => {
    set(route)
  })
  
  // Initialize router
  router.init()
  
  return {
    subscribe,
    navigate: (route: Route, options?: RouterOptions) => router.navigate(route, options),
    back: () => router.back(),
    getCurrentRoute: () => router.getCurrentRoute(),
    getPreviousRoute: () => router.getPreviousRoute(),
    isRoute: (route: Route) => router.isRoute(route),
    getUrl: (route: Route) => router.getUrl(route),
    destroy: () => {
      unsubscribe()
      router.destroy()
    }
  }
}

/**
 * Helper functions for common navigation actions
 */
export function navigateToDialogList(options?: RouterOptions): void {
  getRouter().navigate({ type: 'dialog-list' }, options)
}

export function navigateToGallery(dialogId: string, options?: RouterOptions): void {
  getRouter().navigate({ type: 'gallery', dialogId }, options)
}

export function navigateToSettings(options?: RouterOptions): void {
  getRouter().navigate({ type: 'settings' }, options)
}

/**
 * Check if current URL matches a route
 */
export function isCurrentRoute(route: Route): boolean {
  return getRouter().isRoute(route)
}