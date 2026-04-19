export interface ViewerContent {
  element?: HTMLElement
  data?: { item?: unknown }
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

export function revokeUrls(content: ViewerContent): void {
  if (typeof content.previewUrl === 'string') {
    URL.revokeObjectURL(content.previewUrl)
    content.previewUrl = null
  }

  if (typeof content.fullUrl === 'string') {
    URL.revokeObjectURL(content.fullUrl)
    content.fullUrl = null
  }
}



