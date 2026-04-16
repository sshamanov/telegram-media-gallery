// Telegram file size limits (conservative estimates)
// https://core.telegram.org/api/files#uploading-files

export const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_VIDEO_SIZE = 1 * 1024 * 1024 * 1024 // 1 GB
export const MAX_AUDIO_SIZE = 200 * 1024 * 1024 // 200 MB
export const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024 * 1024 // 2 GB

export function getSizeLimitForMediaType(mediaType: 'photo' | 'video' | 'audio' | 'document'): number {
  switch (mediaType) {
    case 'photo': return MAX_PHOTO_SIZE
    case 'video': return MAX_VIDEO_SIZE
    case 'audio': return MAX_AUDIO_SIZE
    case 'document': return MAX_DOCUMENT_SIZE
  }
}