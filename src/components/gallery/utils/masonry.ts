import type { MediaItem } from '../../../types/telegram'
import type { GalleryLayoutMode } from '../../../types/telegram'

export function analyzeMediaForMasonry(items: MediaItem[]): boolean {
  if (items.length === 0) return false
  
  // Analyze first 100 items
  const sample = items.slice(0, Math.min(100, items.length))
  let visualCount = 0
  
  for (const item of sample) {
    if (item.type === 'photo' || item.type === 'video' || item.type === 'document-image') {
      visualCount++
    }
  }
  
  // Suggest masonry if ≥90% visual content
  return visualCount / sample.length >= 0.9
}

export function getMasonryLayoutClass(shouldUseMasonry: boolean): string {
  return shouldUseMasonry ? 'masonry-grid' : 'grid'
}

export function shouldUseMasonryLayout(
  layoutMode: GalleryLayoutMode,
  galleryViewMode: 'grid' | 'list'
): boolean {
  return layoutMode === 'masonry' && galleryViewMode === 'grid'
}

export function getNextLayoutMode(currentMode: GalleryLayoutMode): GalleryLayoutMode {
  return currentMode === 'grid' ? 'masonry' : 'grid'
}

export function getLayoutModeTooltip(currentMode: GalleryLayoutMode): string {
  return currentMode === 'grid' ? 'Switch to masonry layout' : 'Switch to grid layout'
}