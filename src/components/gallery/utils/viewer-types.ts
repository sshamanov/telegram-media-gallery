import type { MediaItem } from '../../../types/telegram'

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