import type { Chat, Photo, Document, Audio, Voice } from '@mtcute/web'
import type { Dialog, UploadMode } from '../../../types/telegram'
import { getSizeLimitForMediaType } from '../constants'
import { debugLog } from '../../debug'

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isPasswordRequired(error: unknown): boolean {
  return errorMessage(error).includes('SESSION_PASSWORD_NEEDED')
}

export function documentDimensions(document: Document): { width: number; height: number } {
  const attributes = ((document.raw as { attributes?: unknown }).attributes ?? []) as Array<Record<string, unknown>>

  for (const attribute of attributes) {
    if (attribute._ === 'documentAttributeImageSize' || attribute._ === 'documentAttributeVideo') {
      return {
        width: typeof attribute.w === 'number' ? attribute.w : 0,
        height: typeof attribute.h === 'number' ? attribute.h : 0,
      }
    }
  }

  return { width: 0, height: 0 }
}

export function documentDuration(document: Document): number | null {
  const attributes = ((document.raw as { attributes?: unknown }).attributes ?? []) as Array<Record<string, unknown>>

  for (const attribute of attributes) {
    if ((attribute._ === 'documentAttributeVideo' || attribute._ === 'documentAttributeAudio') && typeof attribute.duration === 'number') {
      return attribute.duration
    }
  }

  return null
}

export function fileLikeName(media: Document | Audio | Voice): string | null {
  return media.fileName ?? null
}

export function fileLikeDimensions(media: Document | Audio | Voice): { width: number; height: number } {
  return documentDimensions(media as unknown as Document)
}

export function fileLikeDuration(media: Document | Audio | Voice): number | null {
  return documentDuration(media as unknown as Document)
}

export function photoSize(photo: Photo): number | null {
  return photo.fileSize ?? null
}

export function uploadMediaType(file: File, mode: UploadMode): 'audio' | 'document' | 'photo' | 'video' {
  if (mode === 'file') {
    return 'document'
  }

  let detected: 'photo' | 'video' | 'audio' | 'document' = 'document'

  if (file.type.startsWith('image/')) {
    detected = 'photo'
  } else if (file.type.startsWith('video/')) {
    detected = 'video'
  } else if (file.type.startsWith('audio/')) {
    detected = 'audio'
  }

  // If detected media type has a size limit and file exceeds it, fall back to document
  if (detected !== 'document') {
    const limit = getSizeLimitForMediaType(detected)
    if (file.size > limit) {
      debugLog(`File size ${file.size} exceeds ${detected} limit ${limit}, falling back to document`)
      detected = 'document'
    }
  }

  return detected
}

export function mapPeer(peer: Chat | import('@mtcute/web').User): Dialog {
  if (peer.type === 'user') {
    return {
      id: String(peer.id),
      title: peer.displayName,
      kind: 'chat',
      subtitle: peer.username ? `@${peer.username}` : 'Direct chat',
      username: peer.username ?? null,
    }
  }

  const subtitle = peer.chatType === 'channel'
    ? 'Channel'
    : peer.chatType === 'supergroup'
      ? 'Supergroup'
      : 'Group'

  return {
    id: String(peer.id),
    title: peer.displayName,
    kind: 'group',
    subtitle,
    username: peer.username ?? null,
  }
}