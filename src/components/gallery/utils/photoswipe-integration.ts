import type PhotoSwipe from 'photoswipe'
import type { SlideData } from 'photoswipe'
import type { MediaItem } from '../../../types/telegram'
import { isImageItem, isVideoItem, isPdfItem, isTextItem, isAudioItem } from '../../../lib/media'

export interface ViewerContent {
  element?: HTMLElement
  data?: { item?: MediaItem }
  previewUrl?: string | null
  fullUrl?: string | null
  width?: number
  height?: number
  slide?: {
    width: number
    height: number
    updateContentSize: (force?: boolean) => void
    zoomAndPanToInitial: () => void
    applyCurrentZoomPan: () => void
  }
}

export function createDataSource(items: MediaItem[]): SlideData[] {
  return items.map((item) => ({
    type: isImageItem(item) ? 'image' : 'html',
    html: isImageItem(item) ? undefined : '<div class="pswp__content"></div>',
    src: isImageItem(item) ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' : undefined,
    width: item.width || (isVideoItem(item) ? 1280 : isPdfItem(item) || isTextItem(item) || isAudioItem(item) ? 960 : 1600),
    height: item.height || (isVideoItem(item) ? 720 : isPdfItem(item) || isTextItem(item) || isAudioItem(item) ? 720 : 1200),
    alt: item.filename,
    item,
  }))
}

export function createShell(className: string): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.className = className
  return wrapper
}

export function markLoaded(event: { content: { onLoaded: () => void } }): void {
  event.content.onLoaded()
}

export interface PhotoSwipeOptions {
  index: number
  bgOpacity?: number
  close?: boolean
  zoom?: boolean
  counter?: boolean
  arrowPrev?: boolean
  arrowNext?: boolean
  secondaryZoomLevel?: number
  padding?: { top: number; right: number; bottom: number; left: number }
}

export async function initPhotoSwipe(
  _element: HTMLElement,
  items: MediaItem[],
  options: PhotoSwipeOptions
): Promise<PhotoSwipe> {
  // Dynamically import PhotoSwipe only when needed
  const PhotoSwipeModule = await import('photoswipe')
  const PhotoSwipe = PhotoSwipeModule.default
  // Also dynamically import PhotoSwipe CSS
  await import('photoswipe/style.css')

  const {
    index,
    bgOpacity = 1,
    close = false,
    zoom = false,
    counter = false,
    arrowPrev = false,
    arrowNext = false,
    secondaryZoomLevel = 2,
    padding = { top: 88, right: 24, bottom: 92, left: 24 }
  } = options

  const pswp = new PhotoSwipe({
    dataSource: createDataSource(items),
    index,
    bgOpacity,
    close,
    zoom,
    counter,
    arrowPrev,
    arrowNext,
    secondaryZoomLevel,
    maxZoomLevel: (zoomLevelObject) => {
      const item = zoomLevelObject.itemData.item as MediaItem | undefined
      return item && isImageItem(item) ? 4 : 1
    },
    wheelToZoom: true,
    imageClickAction: 'zoom-or-close',
    paddingFn: () => padding,
  })

  pswp.addFilter('isContentZoomable', (isZoomable, content) => {
    const item = (content.data as { item?: MediaItem } | undefined)?.item
    return item ? isImageItem(item) : isZoomable
  })

  return pswp
}

export function destroyPhotoSwipe(instance: PhotoSwipe | null): void {
  if (instance) {
    instance.destroy()
  }
}

export function attachPhotoSwipeEvents(
  instance: PhotoSwipe,
  handlers: {
    onClose?: () => void
    onSlideChange?: (instance: PhotoSwipe) => void
  }
): () => void {
  const cleanupFunctions: Array<() => void> = []

  if (handlers.onClose) {
    instance.on('close', handlers.onClose)
    cleanupFunctions.push(() => instance.off('close', handlers.onClose!))
  }

  if (handlers.onSlideChange) {
    const handler = () => handlers.onSlideChange!(instance)
    instance.on('change', handler)
    cleanupFunctions.push(() => instance.off('change', handler))
  }

  return () => {
    cleanupFunctions.forEach(fn => fn())
  }
}