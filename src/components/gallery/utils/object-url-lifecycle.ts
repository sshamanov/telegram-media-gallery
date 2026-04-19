import type { ViewerContent } from './viewer-types'

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



