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

export type UploadQueueItemStatus = 'queued' | 'uploading' | 'complete' | 'error' | 'cancelled' | 'paused'

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
  directoryHandle: FileSystemDirectoryHandle | null
}

export type ForwardQueueItemStatus = 'queued' | 'forwarding' | 'complete' | 'error' | 'cancelled'

export interface ForwardQueueItem {
  id: string
  mediaItemId: string
  fileName: string
  sourceDialogId: string
  sourceMessageId: number
  targetDialogId: string
  progress: number
  status: ForwardQueueItemStatus
  error: string | null
}

export interface ForwardQueueState {
  active: boolean
  currentIndex: number
  items: ForwardQueueItem[]
  totalItems: number
  completedItems: number
}

export type ShareQueueItemStatus = 'queued' | 'sharing' | 'complete' | 'error' | 'cancelled'

export interface ShareQueueItem {
  id: string
  mediaItemId: string
  fileName: string
  progress: number
  status: ShareQueueItemStatus
  error: string | null
}

export interface ShareQueueState {
  active: boolean
  currentIndex: number
  items: ShareQueueItem[]
  totalItems: number
  completedItems: number
}

export type CopyQueueItemStatus = 'queued' | 'copying' | 'complete' | 'error' | 'cancelled'

export interface CopyQueueItem {
  id: string
  mediaItemId: string
  fileName: string
  progress: number
  status: CopyQueueItemStatus
  error: string | null
}

export interface CopyQueueState {
  active: boolean
  currentIndex: number
  items: CopyQueueItem[]
  totalItems: number
  completedItems: number
}
