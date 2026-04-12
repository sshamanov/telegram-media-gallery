import type { Dialog, Message, TgMedia, UploadMode } from '../../types/telegram'
import type { MessagePage, TelegramAdapter } from './adapter'

// Sample file metadata - mapping from mock media IDs to actual files in ./samples/
const SAMPLE_FILES = [
  // Photos
  { id: 'photo_001', file: 'DSC_3238.JPG', kind: 'photo' as const, width: 1280, height: 960, size: 1330836 },
  { id: 'photo_002', file: 'DSC_3719.JPG', kind: 'photo' as const, width: 2560, height: 1920, size: 14550647 },
  { id: 'photo_003', file: 'DSC_4859.JPG', kind: 'photo' as const, width: 1920, height: 1280, size: 10705391 },
  { id: 'photo_004', file: 'photo_5310163532189997432_y.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 230021 },
  { id: 'photo_005', file: 'photo_5350612872758761019_y.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 223111 },
  { id: 'photo_006', file: 'photo_5377531571696506656_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 152526 },
  { id: 'photo_007', file: 'photo_5386669157568419546_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 355372 },
  { id: 'photo_008', file: 'photo_5388733052562905250_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 760232 },
  { id: 'photo_009', file: 'photo_5388733052562905280_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 216912 },
  { id: 'photo_010', file: 'photo_5388733052562905285_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 300725 },
  { id: 'photo_011', file: 'photo_5388920957382104293_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 214252 },
  { id: 'photo_012', file: 'photo_5388920957382104303_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 402466 },
  { id: 'photo_013', file: 'photo_5388920957382104304_w.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 399117 },
  { id: 'photo_014', file: 'PXL_20260327_154052656.jpg', kind: 'photo' as const, width: 1280, height: 720, size: 1740375 },
  
  // Videos
  { id: 'video_001', file: 'DSC_2406.MOV', kind: 'video' as const, width: 1920, height: 1080, size: 113795610, durationSeconds: 30 },
  { id: 'video_002', file: 'DSC_3569.MOV', kind: 'video' as const, width: 1920, height: 1080, size: 67652853, durationSeconds: 20 },
  { id: 'video_003', file: 'DSC_4118.MOV', kind: 'video' as const, width: 1920, height: 1080, size: 49818024, durationSeconds: 15 },
  { id: 'video_004', file: 'document_5350612872298798312.mp4', kind: 'video' as const, width: 1280, height: 720, size: 5035584, durationSeconds: 10 },
  { id: 'video_005', file: 'PXL_20260104_120213849~2.mp4', kind: 'video' as const, width: 1280, height: 720, size: 14101718, durationSeconds: 25 },
  { id: 'video_006', file: 'PXL_20260327_154054202.mp4', kind: 'video' as const, width: 1280, height: 720, size: 12969182, durationSeconds: 20 },
  
  // Documents
  { id: 'doc_001', file: 'Android_Studio.pdf', kind: 'document' as const, size: 13158885 },
  { id: 'doc_002', file: 'guide-nb-interests.pdf', kind: 'document' as const, size: 345814 },
  { id: 'doc_003', file: 'NIKON_Horror_Movie_Release_FINAL.pdf', kind: 'document' as const, size: 402590 },
  { id: 'doc_004', file: 'ls.txt', kind: 'document' as const, size: 6662 },
  
  // Audio
  { id: 'audio_001', file: 'Divna Ljubojevic - Kyrie Eleison Kirie zleison.m4a', kind: 'document' as const, size: 2944183, durationSeconds: 180 },
  { id: 'audio_002', file: 'sbornik - Otche nash Dubenskogo.m4a', kind: 'document' as const, size: 2786136, durationSeconds: 200 },
]

const SAMPLE_DIALOGS: Dialog[] = [
  {
    id: '1',
    title: 'Personal Gallery',
    kind: 'gallery',
    subtitle: 'Your saved photos & videos',
    lastMessageDate: Date.now() - 86400000,
  },
  {
    id: '2',
    title: 'Family Group',
    kind: 'group',
    subtitle: 'Family chat',
    username: 'familygroup',
    lastMessageDate: Date.now() - 3600000,
  },
  {
    id: '3',
    title: 'John Doe',
    kind: 'chat',
    subtitle: '@johndoe',
    username: 'johndoe',
    lastMessageDate: Date.now() - 7200000,
  },
  {
    id: '4',
    title: 'Work Team',
    kind: 'group',
    subtitle: 'Work discussions',
    username: 'workteam',
    lastMessageDate: Date.now() - 1800000,
  },
  {
    id: '5',
    title: 'Alice Smith',
    kind: 'chat',
    subtitle: '@alicesmith',
    username: 'alicesmith',
    lastMessageDate: Date.now() - 5400000,
  },
]

// Create mock messages using sample files
function createMockMessages(): Record<string, Message[]> {
  const messages: Record<string, Message[]> = {
    '1': [], // Personal Gallery
    '2': [], // Family Group
    '3': [], // John Doe
    '4': [], // Work Team
    '5': [], // Alice Smith
  }
  
  // Distribute sample files across dialogs
  SAMPLE_FILES.forEach((sample, index) => {
    const dialogId = String((index % 5) + 1) // Distribute across 5 dialogs
    const date = Date.now() - index * 86400000 // Stagger dates
    
    const message: Message = {
      id: 1000 + index,
      dialogId,
      date,
      text: `Sample ${sample.kind}: ${sample.file}`,
      sender: dialogId === '1' ? 'You' : ['Mom', 'Dad', 'John Doe', 'Alice', 'Bob'][parseInt(dialogId) - 2] || 'Unknown',
      media: {
        id: sample.id,
        kind: sample.kind,
        fileName: sample.file,
        mimeType: sample.file.endsWith('.jpg') || sample.file.endsWith('.JPG') ? 'image/jpeg' :
                  sample.file.endsWith('.mp4') || sample.file.endsWith('.MOV') ? 'video/mp4' :
                  sample.file.endsWith('.pdf') ? 'application/pdf' :
                  sample.file.endsWith('.txt') ? 'text/plain' :
                  sample.file.endsWith('.m4a') ? 'audio/mp4' :
                  'application/octet-stream',
        size: sample.size,
        width: sample.width ?? null,
        height: sample.height ?? null,
        durationSeconds: sample.durationSeconds ?? null,
      },
    }
    
    messages[dialogId].push(message)
  })
  
  return messages
}

const MOCK_MESSAGES = createMockMessages()

export class MockTelegramAdapter implements TelegramAdapter {
  private session: string | null = 'mock-session-' + Date.now()
  private fileCache = new Map<string, Uint8Array>()

  async sendCode(phone: string): Promise<{ phoneCodeHash: string }> {
    await this.delay(1000)
    localStorage.setItem('phone', phone)
    return { phoneCodeHash: 'mock-hash-' + Date.now() }
  }

  async signIn(_phone: string, code: string, _hash: string): Promise<'ok' | '2fa_required'> {
    await this.delay(1500)
    if (code === '123456') {
      return '2fa_required'
    }
    this.session = 'mock-authenticated-session-' + Date.now()
    localStorage.setItem('session', this.session)
    return 'ok'
  }

  async signIn2FA(password: string): Promise<void> {
    await this.delay(1000)
    if (password === 'password') {
      this.session = 'mock-2fa-session-' + Date.now()
      localStorage.setItem('session', this.session)
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
    localStorage.removeItem('session')
  }

  getSession(): string | null {
    return this.session
  }

  async getDialogs(opts?: { limit?: number; offsetDate?: number }): Promise<Dialog[]> {
    await this.delay(800)
    const limit = opts?.limit ?? SAMPLE_DIALOGS.length
    const offsetDate = opts?.offsetDate ?? 0
    
    return SAMPLE_DIALOGS
      .filter(dialog => !dialog.lastMessageDate || dialog.lastMessageDate > offsetDate)
      .slice(0, limit)
  }

  async getMessages(dialogId: string, opts: { limit: number; offset?: { id: number; date: number } | null }): Promise<MessagePage> {
    await this.delay(600)
    const messages = MOCK_MESSAGES[dialogId] || []
    
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
    
    // For thumbnails, we'll return the full file (simplified)
    // In a real implementation, you'd have separate thumbnail files
    return this.downloadFull(media)
  }

  async downloadFull(media: TgMedia, onProgress?: (pct: number) => void, abortSignal?: AbortSignal): Promise<Uint8Array> {
    await this.delay(100)
    
    if (abortSignal?.aborted) {
      throw new DOMException('Download aborted', 'AbortError')
    }
    
    const cacheKey = `file_${media.id}`
    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey)!
    }
    
    // Find the sample file
    const sample = SAMPLE_FILES.find(s => s.id === media.id)
    if (!sample) {
      throw new Error(`Sample file not found for media ID: ${media.id}`)
    }
    
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
    
    // In a real browser environment, we would fetch the file
    // For now, return an empty array (will be replaced with actual file loading)
    const fileData = new Uint8Array(0)
    this.fileCache.set(cacheKey, fileData)
    
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const mockAdapter = new MockTelegramAdapter()