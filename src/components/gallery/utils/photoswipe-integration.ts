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

