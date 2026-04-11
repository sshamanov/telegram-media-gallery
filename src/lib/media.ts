import type { GalleryFilterId, MediaItem, MediaType, TgMedia } from '../types/telegram'

const LARGE_MEDIA_THRESHOLD = 100 * 1024 * 1024

export const galleryFilters: Array<{ id: GalleryFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'photos', label: 'Photos' },
  { id: 'videos', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'docs', label: 'Docs' },
]

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}

function isAudioMime(mimeType: string): boolean {
  return mimeType.startsWith('audio/')
}

function isPdfMime(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

function isTextMime(mimeType: string): boolean {
  return mimeType.startsWith('text/') || mimeType === 'application/json'
}

function fileExtension(fileName?: string | null): string {
  const normalized = fileName?.trim().toLowerCase() ?? ''
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex >= 0 ? normalized.slice(dotIndex + 1) : ''
}

export function mediaFileExtension(fileName?: string | null): string {
  return fileExtension(fileName)
}

function isImageExtension(extension: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif', 'avif'].includes(extension)
}

function isVideoExtension(extension: string): boolean {
  return ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'].includes(extension)
}

function isAudioExtension(extension: string): boolean {
  return ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus'].includes(extension)
}

function isPdfExtension(extension: string): boolean {
  return extension === 'pdf'
}

function isTextExtension(extension: string): boolean {
  return ['txt', 'md', 'json', 'log', 'csv', 'yaml', 'yml', 'xml'].includes(extension)
}

export function classifyMediaType(media: TgMedia): MediaType {
  const mimeType = media.mimeType ?? ''
  const extension = fileExtension(media.fileName)
  const size = media.size ?? 0
  const isLarge = size > LARGE_MEDIA_THRESHOLD

  if (media.kind === 'photo') {
    return 'photo'
  }

  if (media.kind === 'video') {
    return isLarge ? 'large-video' : 'video'
  }

  if (isImageMime(mimeType) || isImageExtension(extension)) {
    return isLarge ? 'large-image' : 'document-image'
  }

  if (isVideoMime(mimeType) || isVideoExtension(extension)) {
    return isLarge ? 'large-video' : 'document-video'
  }

  if (isAudioMime(mimeType) || isAudioExtension(extension)) {
    return 'document-audio'
  }

  if (isPdfMime(mimeType) || isPdfExtension(extension)) {
    return isLarge ? 'large-file' : 'document-pdf'
  }

  if (isTextMime(mimeType) || isTextExtension(extension)) {
    return isLarge ? 'large-file' : 'document-text'
  }

  return isLarge ? 'large-file' : 'document-other'
}

export function mediaTypeToFilter(type: MediaType): GalleryFilterId {
  switch (type) {
    case 'photo':
    case 'document-image':
    case 'large-image':
      return 'photos'
    case 'video':
    case 'document-video':
    case 'large-video':
      return 'videos'
    case 'document-audio':
      return 'audio'
    default:
      return 'docs'
  }
}

export function matchesFilter(item: MediaItem, filterId: GalleryFilterId): boolean {
  return filterId === 'all' ? true : mediaTypeToFilter(item.type) === filterId
}

export function isImageItem(item: MediaItem): boolean {
  return item.type === 'photo' || item.type === 'document-image'
}

export function isVideoItem(item: MediaItem): boolean {
  return item.type === 'video' || item.type === 'document-video'
}

export function isPdfItem(item: MediaItem): boolean {
  return item.type === 'document-pdf'
}

export function isAudioItem(item: MediaItem): boolean {
  return item.type === 'document-audio'
}

export function isTextItem(item: MediaItem): boolean {
  return item.type === 'document-text'
}

export function isTextLikeFileName(fileName?: string | null): boolean {
  return isTextExtension(fileExtension(fileName))
}

export function isDownloadOnlyItem(item: MediaItem): boolean {
  return item.type === 'document-other' || item.type === 'large-file' || item.type === 'large-image' || item.type === 'large-video'
}

export function hasThumbnail(item: MediaItem): boolean {
  return !isAudioItem(item) && item.type !== 'document-text' && item.type !== 'document-other' && item.type !== 'large-file'
}

export function formatSize(value: number): string {
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`
  }

  return `${value} B`
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) {
    return '-'
  }

  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  const hours = Math.floor(mins / 60)

  if (hours > 0) {
    const remainingMins = mins % 60
    return `${hours}:${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function formatShortDate(value: number): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(value: number): { date: string; time: string } {
  const date = new Date(value)
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
  }
}

export function mediaKindLabel(item: MediaItem): string {
  switch (item.type) {
    case 'photo':
    case 'document-image':
    case 'large-image':
      return 'Image'
    case 'video':
    case 'document-video':
    case 'large-video':
      return 'Video'
    case 'document-audio':
      return 'Audio'
    case 'document-pdf':
      return 'PDF'
    case 'document-text':
      return 'Text'
    default:
      return 'File'
  }
}

export function mediaGlyph(item: MediaItem): string {
  switch (item.type) {
    case 'video':
    case 'document-video':
    case 'large-video':
      return 'VID'
    case 'document-audio':
      return 'AUD'
    case 'document-pdf':
      return 'PDF'
    case 'document-text':
      return 'TXT'
    case 'document-other':
    case 'large-file':
      return 'FILE'
    case 'large-image':
      return 'IMG'
    default:
      return 'IMG'
  }
}
