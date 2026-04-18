import { TelegramClient, type Message as MtcuteMessage, type Photo, type Video, type Document, type Audio, type Voice } from '@mtcute/web'
import { debugLog, debugWarn, DEBUG_MEDIA_SIZES } from '../debug'
import { throttle } from '../files'
import { emit } from '../events'
import { cacheFirstGetDialogs } from './utils/cache-first'
import {
  errorMessage,
  isPasswordRequired,
  fileLikeName,
  fileLikeDimensions,
  fileLikeDuration,
  photoSize,
  uploadMediaType,
  mapPeer
} from './utils/mtcute-helpers'
import type { Dialog, Message, TgMedia, UploadMode } from '../../types/telegram'
import type { MessagePage, TelegramAdapter } from './adapter'
import { getTelegramApiCredentials } from './adapter'

type DownloadableMedia = Photo | Video | Document | Audio | Voice

class MtcuteTelegramAdapter implements TelegramAdapter {
  private session: string | null = localStorage.getItem('session')
  private client: TelegramClient | null = null
  private qrAbortController: AbortController | null = null
  private mediaIndex = new Map<string, DownloadableMedia>()
  private messageDateIndex = new Map<number, number>()

  private createClient(): TelegramClient {
    const { apiId, apiHash } = getTelegramApiCredentials()

    debugLog('mtcute:createClient', {
      hasApiId: Boolean(apiId),
      hasApiHash: Boolean(apiHash),
      hasExistingClient: Boolean(this.client),
    })

    if (!apiId || !apiHash) {
      throw new Error('API ID and API Hash are required')
    }

    this.client = new TelegramClient({
      apiId: Number(apiId),
      apiHash,
      storage: 'telegram-gallery-session',
    })

    return this.client
  }

  private getClient(): TelegramClient {
    return this.client ?? this.createClient()
  }

  private async exportSession(): Promise<string | null> {
    const client = this.getClient()
    this.session = await client.exportSession()
    localStorage.setItem('session', this.session ?? '')
    return this.session
  }

  private registerMedia(media: DownloadableMedia): TgMedia {
    const id = media.fileId
    this.mediaIndex.set(id, media)

    if (media.type === 'photo') {
      return {
        id,
        kind: 'photo',
        fileName: null,
        mimeType: 'image/jpeg',
        size: photoSize(media),
        width: media.width,
        height: media.height,
      }
    }

    return {
      id,
      kind: media.type === 'video' ? 'video' : 'document',
      fileName: media.type === 'video' ? media.fileName ?? null : fileLikeName(media),
      mimeType: media.mimeType,
      size: media.fileSize ?? media.raw.size,
      width: media.type === 'video' ? media.width : fileLikeDimensions(media).width,
      height: media.type === 'video' ? media.height : fileLikeDimensions(media).height,
      durationSeconds: media.type === 'video' || media.type === 'audio' || media.type === 'voice' ? media.duration : fileLikeDuration(media),
    }
  }

  private messageToProject(message: MtcuteMessage): Message | null {
    this.messageDateIndex.set(message.id, Math.floor(message.date.getTime() / 1000))

    if (!message.media) {
      return null
    }

    const media = message.media
    if (media.type !== 'photo' && media.type !== 'video' && media.type !== 'document' && media.type !== 'audio' && media.type !== 'voice') {
      return null
    }

    const projectMedia = this.registerMedia(media)

    return {
      id: message.id,
      dialogId: String(message.chat.id),
      date: message.date.getTime(),
      text: message.text,
      sender: message.sender.displayName,
      media: projectMedia,
    }
  }

  async sendCode(_phone: string): Promise<{ phoneCodeHash: string }> {
    const client = this.getClient()
    localStorage.setItem('phone', _phone)

    debugLog('mtcute:sendCode:start', {
      phone: _phone,
      hasClient: Boolean(client),
    })

    const result = await client.sendCode({ phone: _phone })
    debugLog('mtcute:sendCode:result', {
      keys: Object.keys(result),
      hasPhoneCodeHash: 'phoneCodeHash' in result,
    })
    if (!('phoneCodeHash' in result)) {
      debugWarn('mtcute:sendCode missing phoneCodeHash, exporting session instead')
      await this.exportSession()
      return { phoneCodeHash: '' }
    }

    return { phoneCodeHash: result.phoneCodeHash }
  }

  async signIn(phone: string, code: string, hash: string): Promise<'ok' | '2fa_required'> {
    const client = this.getClient()

    debugLog('mtcute:signIn:start', {
      phone,
      codeLength: code.length,
      hasHash: Boolean(hash),
    })

    try {
      await client.signIn({
        phone,
        phoneCode: code,
        phoneCodeHash: hash,
      })
      await this.exportSession()
      debugLog('mtcute:signIn:success', { phone })
      return 'ok'
    } catch (error) {
      debugWarn('mtcute:signIn:error', {
        phone,
        message: errorMessage(error),
      })
      if (isPasswordRequired(error)) {
        debugLog('mtcute:signIn:passwordRequired', { phone })
        return '2fa_required'
      }

      throw error
    }
  }

  async signIn2FA(password: string): Promise<void> {
    const client = this.getClient()
    debugLog('mtcute:signIn2FA:start', {
      passwordLength: password.length,
    })
    await client.checkPassword(password)
    await this.exportSession()
    debugLog('mtcute:signIn2FA:success')
  }

  async *startQRLogin(onPasswordRequired: () => Promise<string>): AsyncIterable<{ token: string; expires: number }> {
    const client = this.getClient()
    const events: Array<{ token: string; expires: number }> = []
    let notify: (() => void) | null = null
    let finished = false
    let thrown: unknown = null

    this.qrAbortController?.abort()
    this.qrAbortController = new AbortController()

    debugLog('mtcute:qr:start')

    void client.signInQr({
      abortSignal: this.qrAbortController.signal,
      onUrlUpdated: (url, expires) => {
        debugLog('mtcute:qr:urlUpdated', {
          expiresAt: expires.getTime(),
          tokenPreview: url.slice(0, 32),
        })
        events.push({ token: url, expires: expires.getTime() })
        notify?.()
      },
      password: onPasswordRequired,
    }).then(async () => {
      await this.exportSession()
      debugLog('mtcute:qr:success')
      finished = true
      notify?.()
    }).catch((error) => {
      if (this.qrAbortController?.signal.aborted) {
        debugLog('mtcute:qr:aborted')
        finished = true
      } else {
        debugWarn('mtcute:qr:error', {
          message: errorMessage(error),
        })
        thrown = error
      }
      notify?.()
    })

    while (!finished || events.length > 0) {
      if (events.length === 0) {
        await new Promise<void>((resolve) => {
          notify = resolve
        })
        notify = null
      }

      while (events.length > 0) {
        const next = events.shift()
        if (next) {
          yield next
        }
      }

      if (thrown) {
        throw thrown
      }
    }
  }

  async reconnect(session: string): Promise<boolean> {
    try {
      const client = this.createClient()
      await client.importSession(session, true)
      await client.getMe()
      this.session = session
      return true
    } catch {
      this.session = null
      return false
    }
  }

  async logout(): Promise<void> {
    const client = this.getClient()
    await client.logOut()
    this.session = null
    localStorage.removeItem('session')
  }

  getSession(): string | null {
    return this.session
  }

  async getDialogs(_opts?: { limit?: number; offsetDate?: number; forceRefresh?: boolean }): Promise<Dialog[]> {
    // Fetch fresh dialogs from Telegram
    const fetchFreshDialogs = async (): Promise<Dialog[]> => {
      const client = this.getClient()
      const allDialogs: Dialog[] = []
      const seen = new Set<string>()
      for await (const dialog of client.iterDialogs({ limit: Infinity, offsetDate: 0 })) {
        const mapped = mapPeer(dialog.peer)
        mapped.lastMessageDate = dialog.lastMessage?.date.getTime() ?? null
        if (seen.has(mapped.id)) continue
        seen.add(mapped.id)
        allDialogs.push(mapped)
      }
      return allDialogs
    }

    const result = await cacheFirstGetDialogs(
      fetchFreshDialogs,
      _opts,
      5 * 60 * 1000, // 5 minutes TTL
      'mtcute'
    )
    
    return result.dialogs
  }

  async getMessages(dialogId: string, opts: { limit: number; offset?: { id: number; date: number } | null }): Promise<MessagePage> {
    const client = this.getClient()

    debugLog('getMessages:start', {
      dialogId,
      limit: opts.limit,
      requestedOffset: opts.offset ?? null,
    })

    const history = await client.getHistory(dialogId === 'me' ? 'me' : Number(dialogId), {
      limit: opts.limit,
      offset: opts.offset ?? undefined,
    })

    debugLog('getMessages:done', {
      dialogId,
      count: history.length,
      lastId: history[history.length - 1]?.id ?? null,
      next: history.next ?? null,
    })

    return {
      messages: history
        .map((message) => this.messageToProject(message))
        .filter((message): message is Message => message !== null),
      nextOffset: history.next ?? null,
      totalMessages: history.total,
    }
  }

  async downloadThumbnail(media: TgMedia): Promise<Uint8Array | null> {
    const client = this.getClient()
    const stored = this.mediaIndex.get(media.id)

    if (!stored) {
      return null
    }

    if (DEBUG_MEDIA_SIZES) {
      debugLog('Media sizes debug:', { id: media.id, kind: media.kind, width: media.width, height: media.height })
    }

    const sizes = ['s', 'm', 'x'] as const
    for (const size of sizes) {
      const thumb = stored.getThumbnail(size)
      if (DEBUG_MEDIA_SIZES) {
        debugLog(`  ${size}:`, thumb ? { width: thumb.width, height: thumb.height, fileSize: thumb.fileSize } : 'no thumbnail')
      }
      if (thumb) {
        if (DEBUG_MEDIA_SIZES) {
          debugLog(`  selected ${size} thumbnail`)
        }
        return client.downloadAsBuffer(thumb)
      }
    }

    if (DEBUG_MEDIA_SIZES) {
      debugLog('  no thumbnail available')
    }
    return null
  }

  async downloadFull(media: TgMedia, onProgress?: (pct: number) => void, abortSignal?: AbortSignal): Promise<Uint8Array> {
    const client = this.getClient()
    const stored = this.mediaIndex.get(media.id)

    if (!stored) {
      throw new Error('Media handle not found')
    }

    const throttledProgress = onProgress ? throttle(onProgress, 100) : undefined

    const downloadOptions = {
      abortSignal,
      fileSize: media.size ?? undefined,
      progressCallback: (downloaded: number, total: number) => {
        if (!throttledProgress) {
          return
        }

        const max = Number.isFinite(total) ? total : media.size ?? 0
        if (max > 0) {
          throttledProgress(Math.round((downloaded / max) * 100))
        }
      },
    }

    if (DEBUG_MEDIA_SIZES) {
      const start = performance.now()
      debugLog('downloadFull start:', { id: media.id, size: media.size, width: media.width, height: media.height })
      const buffer = await client.downloadAsBuffer(stored, downloadOptions)
      const end = performance.now()
      debugLog('downloadFull completed:', { id: media.id, duration: `${Math.round(end - start)}ms` })
      emit('media:full-downloaded', media.id)
      return buffer
    }

    const buffer = await client.downloadAsBuffer(stored, downloadOptions)
    emit('media:full-downloaded', media.id)
    return buffer
  }

  async uploadAndSend(dialogId: string, file: File, mode: UploadMode, onProgress?: (pct: number) => void, abortSignal?: AbortSignal): Promise<void> {
    const client = this.getClient()
    await client.sendMedia(Number(dialogId), {
      type: uploadMediaType(file, mode),
      file,
      fileName: file.name,
      fileMime: file.type || undefined,
      fileSize: file.size,
    }, {
      abortSignal,
      progressCallback: (uploaded, total) => {
        if (total > 0) {
          onProgress?.(Math.round((uploaded / total) * 100))
        }
      },
    })
  }

  async forwardMessages(toId: string, fromId: string, msgIds: number[]): Promise<void> {
    const client = this.getClient()
    await client.forwardMessagesById({
      toChatId: Number(toId),
      fromChatId: Number(fromId),
      messages: msgIds,
    })
  }
}

export const mtcuteAdapter = new MtcuteTelegramAdapter()
