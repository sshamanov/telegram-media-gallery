import type { Dialog, Message, TgMedia } from '../../../types/telegram'
import { debugWarn } from '../../debug'

export type SampleMedia = TgMedia & {
  sampleFileName?: string | null
}

export type SampleMessage = Omit<Message, 'media'> & {
  media?: SampleMedia | null
}

export type SampleDialogMessages = {
  dialogId: string
  messages: SampleMessage[]
}

// Global caches
let DIALOGS: Dialog[] = []
let messagesCache = new Map<string, Message[]>()
let mediaSampleSources = new Map<string, string | null>()

export function normalizeSampleMedia(media: SampleMedia): TgMedia {
  const sampleFileName = media.sampleFileName ?? media.fileName ?? null
  mediaSampleSources.set(media.id, sampleFileName)

  return {
    id: media.id,
    kind: media.kind,
    fileName: media.fileName ?? null,
    mimeType: media.mimeType ?? null,
    size: media.size ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
    durationSeconds: media.durationSeconds ?? null,
  }
}

export function normalizeSampleMessage(message: SampleMessage, dialogId: string): Message {
  return {
    id: message.id,
    dialogId: message.dialogId ?? dialogId,
    date: message.date,
    text: message.text,
    sender: message.sender ?? null,
    media: message.media ? normalizeSampleMedia(message.media) : null,
  }
}

export function resolveSampleFileName(media: TgMedia): string | null {
  return mediaSampleSources.get(media.id) ?? media.fileName ?? null
}

// Load dialogs from samples/dialogs.json
export async function loadDialogs(): Promise<Dialog[]> {
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
        title: 'Channel News',
        kind: 'group',
        subtitle: 'News updates',
        username: 'channelnews',
        lastMessageDate: 1744351600000,
      },
    ]
    return DIALOGS
  }
}

// Load messages for a specific dialog from samples/dialog-media/{dialogId}.json
export async function loadDialogMessages(dialogId: string): Promise<Message[]> {
  if (messagesCache.has(dialogId)) {
    return messagesCache.get(dialogId)!
  }

  try {
    // Load messages from dialog-media JSON file
    const response = await fetch(`/samples/dialog-media/${dialogId}.json`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as SampleDialogMessages
    const messages = data.messages.map((message) => normalizeSampleMessage(message, data.dialogId))
    
    messagesCache.set(dialogId, messages)
    return messages
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

// Load a file from the samples directory
export async function loadFileFromSamples(fileName: string): Promise<Uint8Array> {
  try {
    const response = await fetch(`/samples/${fileName}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
  } catch (error) {
    debugWarn(`Failed to load sample file ${fileName}:`, error)
    throw error
  }
}