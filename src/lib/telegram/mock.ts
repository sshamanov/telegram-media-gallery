import type { Dialog, Message, TgMedia, UploadMode } from '../../types/telegram'
import type { MessagePage, TelegramAdapter } from './adapter'
import { debugLog, debugWarn, DEBUG_MEDIA_SIZES } from '../debug'
import { emit } from '../events'

// Load dialogs from JSON
let DIALOGS: Dialog[] = []
let messagesCache = new Map<string, Message[]>()

// Load dialogs from samples/dialogs.json
async function loadDialogs(): Promise<Dialog[]> {
  if (DIALOGS.length > 0) return DIALOGS
  
  try {
    const response = await fetch('/samples/dialogs.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    DIALOGS = await response.json()
    return DIALOGS
  } catch (error) {
    debugWarn('Failed to load dialogs.json, using fallback:', error)
    // Fallback to hardcoded dialogs
    DIALOGS = [
      {
        id: '1',
        title: 'Personal Gallery',
        kind: 'gallery',
        subtitle: 'Your saved photos & videos',
        lastMessageDate: 1744351200000,
      },
      {
        id: '2',
        title: 'Family Group',
        kind: 'group',
        subtitle: 'Family chat',
        username: 'familygroup',
        lastMessageDate: 1744351300000,
      },
      {
        id: '3',
        title: 'John Doe',
        kind: 'chat',
        subtitle: '@johndoe',
        username: 'johndoe',
        lastMessageDate: 1744351400000,
      },
      {
        id: '4',
        title: 'Work Team',
        kind: 'group',
        subtitle: 'Work discussions',
        username: 'workteam',
        lastMessageDate: 1744351500000,
      },
      {
        id: '5',
        title: 'Alice Smith',
        kind: 'chat',
        subtitle: '@alicesmith',
        username: 'alicesmith',
        lastMessageDate: 1744351600000,
      },
    ]
    return DIALOGS
  }
}

async function loadDialogMessages(dialogId: string): Promise<Message[]> {
  if (messagesCache.has(dialogId)) {
    return messagesCache.get(dialogId)!
  }

  try {
    // Load messages from dialog-media JSON file
    const response = await fetch(`/samples/dialog-media/${dialogId}.json`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    
    messagesCache.set(dialogId, data.messages)
    return data.messages
  } catch (error) {
    debugWarn(`Failed to load messages for dialog ${dialogId}:`, error)
    
    // Fallback to simulated messages
    const messages: Message[] = []
    const baseDate = Date.now()
    
    for (let i = 0; i < 10; i++) {
      const isPhoto = i % 3 === 0
      const isVideo = i % 3 === 1
      const date = baseDate - i * 86400000
      
      messages.push({
        id: parseInt(dialogId) * 1000 + i,
        dialogId,
        date,
        text: isPhoto ? `Photo ${i + 1}` : isVideo ? `Video ${i + 1}` : `Document ${i + 1}`,
        sender: dialogId === '1' ? 'You' : ['Mom', 'Dad', 'John', 'Alice', 'Bob'][parseInt(dialogId) - 1] || 'Unknown',
        media: {
          id: `media_${dialogId}_${i}`,
          kind: isPhoto ? 'photo' : isVideo ? 'video' : 'document',
          fileName: isPhoto ? `photo_${i}.jpg` : isVideo ? `video_${i}.mp4` : `document_${i}.pdf`,
          mimeType: isPhoto ? 'image/jpeg' : isVideo ? 'video/mp4' : 'application/pdf',
          size: isPhoto ? 1024 * 1024 * (2 + Math.random() * 3) : 
                isVideo ? 1024 * 1024 * (10 + Math.random() * 20) : 
                1024 * 1024 * (1 + Math.random() * 2),
          width: isPhoto ? 1920 : isVideo ? 1280 : null,
          height: isPhoto ? 1080 : isVideo ? 720 : null,
          durationSeconds: isVideo ? 30 + Math.random() * 90 : null,
        },
      })
    }
    
    messagesCache.set(dialogId, messages)
    return messages
  }
}

async function loadFileFromSamples(fileName: string): Promise<Uint8Array> {
  try {
    const response = await fetch(`/samples/${fileName}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${fileName}`)
    }
    const buffer = await response.arrayBuffer()
    const data = new Uint8Array(buffer)
    if (data.length === 0) {
      debugWarn(`Loaded empty file ${fileName}`)
    }
    return data
  } catch (error) {
    debugWarn(`Failed to load file ${fileName}:`, error)
    // Return empty data as fallback
    return new Uint8Array(0)
  }
}

export class MockTelegramAdapter implements TelegramAdapter {
  private session: string | null = 'mock-session-' + Date.now()
  private fileCache = new Map<string, Uint8Array>()

  async sendCode(phone: string): Promise<{ phoneCodeHash: string }> {
    await this.delay(1000)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('phone', phone)
    }
    return { phoneCodeHash: 'mock-hash-' + Date.now() }
  }

  async signIn(_phone: string, code: string, _hash: string): Promise<'ok' | '2fa_required'> {
    await this.delay(1500)
    if (code === '123456') {
      return '2fa_required'
    }
    this.session = 'mock-authenticated-session-' + Date.now()
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('session', this.session)
    }
    return 'ok'
  }

  async signIn2FA(password: string): Promise<void> {
    await this.delay(1000)
    if (password === 'password') {
      this.session = 'mock-2fa-session-' + Date.now()
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('session', this.session)
      }
    } else {
      throw new Error('Invalid password')
    }
  }

  async *startQRLogin(onPasswordRequired: () => Promise<string>): AsyncIterable<{ token: string; expires: number }> {
    for (let i = 0; i < 3; i++) {
      await this.delay(1000)
      yield {
        token: `mock-qr-token-${i}-${Date.now()}`,
        expires: Date.now() + 30000,
      }
    }
    
    await this.delay(2000)
    const password = await onPasswordRequired()
    if (password === 'password') {
      this.session = 'mock-qr-session-' + Date.now()
      localStorage.setItem('session', this.session)
    } else {
      throw new Error('Invalid password')
    }
  }

  async reconnect(session: string): Promise<boolean> {
    await this.delay(800)
    if (session.includes('mock')) {
      this.session = session
      return true
    }
    return false
  }

  async logout(): Promise<void> {
    await this.delay(500)
    this.session = null
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('session')
    }
  }

  getSession(): string | null {
    return this.session
  }

  async getDialogs(opts?: { limit?: number; offsetDate?: number }): Promise<Dialog[]> {
    await this.delay(800)
    const dialogs = await loadDialogs()
    const limit = opts?.limit ?? dialogs.length
    const offsetDate = opts?.offsetDate ?? 0
    
    return dialogs
      .filter(dialog => !dialog.lastMessageDate || dialog.lastMessageDate > offsetDate)
      .slice(0, limit)
  }

  async getMessages(dialogId: string, opts: { limit: number; offset?: { id: number; date: number } | null }): Promise<MessagePage> {
    await this.delay(600)
    const messages = await loadDialogMessages(dialogId)
    
    let filtered = messages
    if (opts.offset) {
      filtered = messages.filter(msg => 
        msg.date < opts.offset!.date || 
        (msg.date === opts.offset!.date && msg.id < opts.offset!.id)
      )
    }
    
    const sliced = filtered.slice(0, opts.limit)
    const nextOffset = sliced.length > 0 && sliced.length < filtered.length 
      ? { id: sliced[sliced.length - 1].id, date: sliced[sliced.length - 1].date }
      : null
    
    return {
      messages: sliced,
      nextOffset,
      totalMessages: messages.length,
    }
  }

  async downloadThumbnail(media: TgMedia): Promise<Uint8Array | null> {
    await this.delay(300)
    
    if (DEBUG_MEDIA_SIZES) {
      debugLog('Mock thumbnail debug:', { id: media.id, kind: media.kind, width: media.width, height: media.height })
    }
    
    const cacheKey = `thumb_${media.id}`
    if (this.fileCache.has(cacheKey)) {
      if (DEBUG_MEDIA_SIZES) {
        debugLog('Mock thumbnail: returning cached thumbnail for', media.id)
      }
      return this.fileCache.get(cacheKey)!
    }
    
    // Simulate missing thumbnails for some media IDs to test glyph fallback
    // Return null for media IDs ending with '3' or '7' to test the fallback behavior
    if (media.id.endsWith('3') || media.id.endsWith('7')) {
      if (DEBUG_MEDIA_SIZES) {
        debugLog('Mock thumbnail: simulated missing thumbnail for', media.id)
      }
      return null
    }
    
    // For photos, we can use the actual file as thumbnail
    if (media.kind === 'photo' && media.fileName) {
      try {
        const fileData = await loadFileFromSamples(media.fileName)
        if (fileData.length > 0) {
          this.fileCache.set(cacheKey, fileData)
          if (DEBUG_MEDIA_SIZES) {
            debugLog('Mock thumbnail: returning actual photo file for', media.id)
          }
          return fileData
        }
      } catch (error) {
        debugWarn(`Failed to load thumbnail for ${media.fileName}:`, error)
      }
    }
    
    // For other media types or if photo loading failed, create a colored placeholder
    // Check if we're in a browser environment (has document)
    if (typeof document !== 'undefined') {
      // Create a simple 100x100 colored PNG based on media type
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Set background color based on media type
        switch (media.kind) {
          case 'photo':
            ctx.fillStyle = '#4CAF50' // Green for photos
            break
          case 'video':
            ctx.fillStyle = '#2196F3' // Blue for videos
            break
          case 'document':
            ctx.fillStyle = '#FF9800' // Orange for documents
            break
          default:
            ctx.fillStyle = '#9E9E9E' // Gray for others
        }
        
        ctx.fillRect(0, 0, 100, 100)
        
        // Add media type icon/text
        ctx.fillStyle = 'white'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        const typeText = media.kind === 'photo' ? '📷' : 
                        media.kind === 'video' ? '🎬' : 
                        media.kind === 'document' ? '📄' : '📁'
        ctx.fillText(typeText, 50, 50)
        
        // Add file extension
        ctx.font = '10px Arial'
        const ext = media.fileName ? media.fileName.split('.').pop()?.toUpperCase() || 'FILE' : 'FILE'
        ctx.fillText(ext, 50, 70)
        
        // Convert canvas to PNG
        if (DEBUG_MEDIA_SIZES) {
          debugLog('Mock thumbnail: generating colored placeholder for', media.id, media.kind)
        }
        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              blob.arrayBuffer().then(buffer => {
                const pngData = new Uint8Array(buffer)
                this.fileCache.set(cacheKey, pngData)
                resolve(pngData)
              })
            } else {
              resolve(this.createFallbackPng())
            }
          }, 'image/png')
        })
      }
    }
    
    // Fallback to 1x1 transparent PNG
    if (DEBUG_MEDIA_SIZES) {
      debugLog('Mock thumbnail: fallback to 1x1 PNG for', media.id)
    }
    return this.createFallbackPng()
  }

  async downloadFull(media: TgMedia, onProgress?: (pct: number) => void, abortSignal?: AbortSignal): Promise<Uint8Array> {
    await this.delay(100)
    
    if (DEBUG_MEDIA_SIZES) {
      debugLog('Mock downloadFull start:', { id: media.id, size: media.size, width: media.width, height: media.height })
    }
    
    if (abortSignal?.aborted) {
      throw new DOMException('Download aborted', 'AbortError')
    }
    
    const cacheKey = `full_${media.id}`
    if (this.fileCache.has(cacheKey)) {
      if (DEBUG_MEDIA_SIZES) {
        debugLog('Mock downloadFull: returning cached full media for', media.id)
      }
      emit('media:full-downloaded', media.id)
      return this.fileCache.get(cacheKey)!
    }
    
    // Try to load actual file from samples directory
    if (media.fileName) {
      try {
        // Simulate download progress
        if (onProgress) {
          for (let i = 0; i <= 100; i += 10) {
            await this.delay(50)
            if (abortSignal?.aborted) {
              throw new DOMException('Download aborted', 'AbortError')
            }
            onProgress(i)
          }
        }
        
        const fileData = await loadFileFromSamples(media.fileName)
        if (fileData.length > 0) {
          this.fileCache.set(cacheKey, fileData)
          if (DEBUG_MEDIA_SIZES) {
            debugLog('Mock downloadFull: returning actual file for', media.id)
          }
          emit('media:full-downloaded', media.id)
          return fileData
        }
      } catch (error) {
        debugWarn(`Failed to load full file ${media.fileName}:`, error)
      }
    }
    
    // Fallback: return empty data
    const fileData = new Uint8Array(0)
    this.fileCache.set(cacheKey, fileData)
    
    if (DEBUG_MEDIA_SIZES) {
      debugLog('Mock downloadFull: returning empty fallback for', media.id)
    }
    emit('media:full-downloaded', media.id)
    return fileData
  }

  async uploadAndSend(_dialogId: string, _file: File, _mode: UploadMode, onProgress?: (pct: number) => void, abortSignal?: AbortSignal): Promise<void> {
    await this.delay(100)
    
    if (abortSignal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError')
    }
    
    if (onProgress) {
      for (let i = 0; i <= 100; i += 10) {
        await this.delay(100)
        if (abortSignal?.aborted) {
          throw new DOMException('Upload aborted', 'AbortError')
        }
        onProgress(i)
      }
    }
    
    await this.delay(500)
  }

  async forwardMessages(_toId: string, _fromId: string, _msgIds: number[]): Promise<void> {
    await this.delay(1000)
  }

  private createFallbackPng(): Uint8Array {
    // 1x1 transparent PNG
    return new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ])
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const mockAdapter = new MockTelegramAdapter()