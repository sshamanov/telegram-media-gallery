import { readdirSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const SAMPLES_DIR = './samples'

// Get all media files
const files = readdirSync(SAMPLES_DIR).filter(file => {
  if (file === 'INDEX.md' || file === 'dialogs.json' || file.startsWith('.')) {
    return false
  }
  const ext = file.toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'pdf', 'txt', 'm4a'].includes(ext)
})

console.log(`Found ${files.length} media files`)

// Categorize files
const photos = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
const videos = files.filter(f => /\.(mp4|mov)$/i.test(f))
const documents = files.filter(f => /\.(pdf|txt)$/i.test(f))
const audio = files.filter(f => /\.(m4a)$/i.test(f))

console.log(`Photos: ${photos.length}, Videos: ${videos.length}, Documents: ${documents.length}, Audio: ${audio.length}`)

// Create dialog media files
const dialogs = [
  { id: '1', title: 'Personal Gallery', kind: 'gallery' },
  { id: '2', title: 'Family Group', kind: 'group' },
  { id: '3', title: 'John Doe', kind: 'chat' },
  { id: '4', title: 'Work Team', kind: 'group' },
  { id: '5', title: 'Alice Smith', kind: 'chat' },
]

// Distribute files across dialogs
dialogs.forEach((dialog, dialogIndex) => {
  const messages = []
  let messageId = 1000 + dialogIndex * 100
  
  // Get files for this dialog (distribute evenly)
  const dialogFiles = []
  const totalDialogs = dialogs.length
  
  files.forEach((file, fileIndex) => {
    if (fileIndex % totalDialogs === dialogIndex) {
      dialogFiles.push(file)
    }
  })
  
  // Create messages for each file
  dialogFiles.forEach((file, fileIndex) => {
    const ext = file.toLowerCase().split('.').pop()
    const size = statSync(join(SAMPLES_DIR, file)).size
    const date = Date.now() - (dialogIndex * 10000000 + fileIndex * 86400000)
    
    let kind = 'document'
    let mimeType = 'application/octet-stream'
    
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
      kind = 'photo'
      mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
    } else if (['mp4', 'mov'].includes(ext)) {
      kind = 'video'
      mimeType = 'video/mp4'
    } else if (ext === 'pdf') {
      mimeType = 'application/pdf'
    } else if (ext === 'txt') {
      mimeType = 'text/plain'
    } else if (ext === 'm4a') {
      mimeType = 'audio/mp4'
    }
    
    const message = {
      id: messageId++,
      date,
      text: `${kind === 'photo' ? 'Photo' : kind === 'video' ? 'Video' : 'File'}: ${file}`,
      sender: dialogIndex === 0 ? 'You' : ['Mom', 'Dad', 'John Doe', 'Alice', 'Bob'][dialogIndex - 1] || 'Unknown',
      media: {
        id: `${kind}_${dialogIndex}_${fileIndex}`,
        kind,
        fileName: file,
        mimeType,
        size,
        width: kind === 'photo' || kind === 'video' ? 1280 : null,
        height: kind === 'photo' || kind === 'video' ? 720 : null,
        durationSeconds: kind === 'video' || kind === 'audio' ? 30 + Math.floor(Math.random() * 180) : null,
      },
    }
    
    messages.push(message)
  })
  
  // Create dialog media JSON
  const dialogMedia = {
    dialogId: dialog.id,
    messages,
    totalMessages: messages.length * 3, // Simulate more messages than shown
  }
  
  const outputPath = join(SAMPLES_DIR, 'dialog-media', `${dialog.id}.json`)
  writeFileSync(outputPath, JSON.stringify(dialogMedia, null, 2))
  console.log(`Created ${outputPath} with ${messages.length} messages`)
})

console.log('Done!')