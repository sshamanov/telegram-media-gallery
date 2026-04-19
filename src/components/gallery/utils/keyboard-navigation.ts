import type { MediaItem } from '../../../types/telegram'

export interface KeyboardNavigationOptions {
  mediaItems: MediaItem[]
  focusedIndex: number | null
  isSelectionMode: boolean
  galleryViewMode: 'grid' | 'list'
  effectiveColumns: number
  onOpenItem: (itemId: string) => void
  onToggleSelection: (itemId: string) => void
  onExitSelectionMode: () => void
}

export interface KeyboardNavigationResult {
  handled: boolean
  newFocusedIndex?: number | null
  action?: 'open' | 'toggle' | 'exit'
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false
  }
  
  // Check for form elements
  if (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement) {
    return true
  }
  
  // Check for contenteditable elements
  if (target.isContentEditable) {
    return true
  }
  
  return false
}

export function handleGalleryKeyDown(
  event: KeyboardEvent,
  options: KeyboardNavigationOptions
): KeyboardNavigationResult {
  const { mediaItems, focusedIndex, isSelectionMode, galleryViewMode, effectiveColumns, onOpenItem, onToggleSelection, onExitSelectionMode } = options

  if (event.key === 'Escape' && isSelectionMode) {
    onExitSelectionMode()
    return { handled: true, action: 'exit' }
  }

  // Don't handle keyboard navigation if we're in a text entry element
  if (isTextEntryTarget(event.target)) {
    return { handled: false }
  }

  // Handle arrow key navigation
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    const newIndex = handleArrowNavigation(event.key, {
      mediaItems,
      focusedIndex,
      galleryViewMode,
      effectiveColumns
    })
    return { handled: true, newFocusedIndex: newIndex }
  } else if (event.key === 'Enter' && focusedIndex !== null) {
    // Enter opens the focused item
    const item = mediaItems[focusedIndex]
    if (item) {
      onOpenItem(item.id)
      return { handled: true, action: 'open' }
    }
  } else if (event.key === ' ' && focusedIndex !== null) {
    // Space toggles selection of focused item
    const item = mediaItems[focusedIndex]
    if (item) {
      onToggleSelection(item.id)
      return { handled: true, action: 'toggle' }
    }
  }

  return { handled: false }
}

export interface ArrowNavigationOptions {
  mediaItems: MediaItem[]
  focusedIndex: number | null
  galleryViewMode: 'grid' | 'list'
  effectiveColumns: number
}

export function handleArrowNavigation(
  key: string,
  options: ArrowNavigationOptions
): number | null {
  const { mediaItems, focusedIndex, galleryViewMode, effectiveColumns } = options
  
  if (mediaItems.length === 0) {
    return null
  }

  const totalItems = mediaItems.length

  if (focusedIndex === null) {
    // Start navigation from first item
    return 0
  }

  let newIndex = focusedIndex

  if (galleryViewMode === 'grid') {
    // Grid navigation
    if (key === 'ArrowRight') {
      newIndex = (focusedIndex + 1) % totalItems
    } else if (key === 'ArrowLeft') {
      newIndex = focusedIndex === 0 ? totalItems - 1 : focusedIndex - 1
    } else if (key === 'ArrowDown') {
      newIndex = Math.min(focusedIndex + effectiveColumns, totalItems - 1)
    } else if (key === 'ArrowUp') {
      newIndex = Math.max(focusedIndex - effectiveColumns, 0)
    }
  } else {
    // List navigation (single column)
    if (key === 'ArrowDown') {
      newIndex = Math.min(focusedIndex + 1, totalItems - 1)
    } else if (key === 'ArrowUp') {
      newIndex = Math.max(focusedIndex - 1, 0)
    } else if (key === 'ArrowRight' || key === 'ArrowLeft') {
      // In list view, left/right don't navigate between items
      return focusedIndex
    }
  }

  return newIndex
}

export function scrollFocusedItemIntoView(itemId: string): void {
  setTimeout(() => {
    const focusedElement = document.querySelector(`[data-item-id="${itemId}"]`)
    if (focusedElement) {
      focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, 0)
}