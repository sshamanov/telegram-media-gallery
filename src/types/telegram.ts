export type AuthState = 'idle' | 'connecting' | 'connected' | 'error'

export interface Dialog {
  id: string
  title: string
  kind: 'gallery' | 'group' | 'chat'
  subtitle: string
  avatarUrl?: string | null
  username?: string | null
  lastMessageDate?: number | null
}

export interface TgMedia {
  id: string
  kind: 'photo' | 'video' | 'document'
  fileName?: string | null
  mimeType?: string | null
  size?: number | null
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
}

export type MediaType =
  | 'photo'
  | 'video'
  | 'document-image'
  | 'document-video'
  | 'document-audio'
  | 'document-pdf'
  | 'document-text'
  | 'document-other'
  | 'large-image'
  | 'large-video'
  | 'large-file'

export type GalleryFilterId = 'all' | 'photos' | 'videos' | 'audio' | 'docs'

export type GalleryViewMode = 'grid' | 'list'

export type UploadMode = 'media' | 'file'

export interface Message {
  id: number
  dialogId: string
  date: number
  text?: string
  sender?: string | null
  media?: TgMedia | null
}

export interface MediaItem {
  id: string
  dialogId: string
  messageId: number
  filename: string
  mimeType: string
  type: MediaType
  width: number
  height: number
  size: number
  durationSeconds: number | null
  date: number
  sender?: string | null
  caption?: string
  thumbUrl?: string | null
  fullUrl?: string | null
  media: TgMedia
}

export type AppTheme = 'dark' | 'light' | 'system'

export interface AppSettings {
  thumbCacheLimit: number
  fullCacheLimit: number
  maxCacheSizeMb: number
  gridColumns: number
  defaultHiddenFilters: GalleryFilterId[]
  theme: AppTheme
}

export interface ToastMessage {
  id: string
  kind: 'success' | 'error' | 'info' | 'warning'
  text: string
  dismissible: boolean
}

export interface SessionSnapshot {
  phone?: string
  session: string | null
}

export interface UploadState {
  active: boolean
  fileName: string | null
  progress: number
  error: string | null
  mode: UploadMode
}

export type UploadQueueItemStatus = 'queued' | 'uploading' | 'complete' | 'error' | 'cancelled'

export interface UploadQueueItem {
  id: string
  file: File
  fileName: string
  progress: number
  status: UploadQueueItemStatus
  error: string | null
  mode: UploadMode
}

export interface UploadQueueState {
  active: boolean
  mode: UploadMode
  currentIndex: number
  items: UploadQueueItem[]
}

export type DownloadQueueItemStatus = 'queued' | 'downloading' | 'complete' | 'error' | 'cancelled'

export interface DownloadQueueItem {
  id: string
  mediaItemId: string
  fileName: string
  progress: number
  status: DownloadQueueItemStatus
  error: string | null
}

export interface DownloadQueueState {
  active: boolean
  currentIndex: number
  items: DownloadQueueItem[]
  totalItems: number
  completedItems: number
}
