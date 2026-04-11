export async function createImageThumbnail(blob: Blob, maxEdge = 512): Promise<Blob | null> {
  const url = URL.createObjectURL(blob)

  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to decode image'))
      image.src = url
    })

    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.drawImage(image, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86)
    const response = await fetch(dataUrl)
    return await response.blob()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function createVideoThumbnail(blob: Blob, maxEdge = 512): Promise<Blob | null> {
  const url = URL.createObjectURL(blob)

  try {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video'))
      video.src = url
    })

    if (video.duration && Number.isFinite(video.duration) && video.duration > 0.1) {
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve()
        video.onerror = () => reject(new Error('Failed to seek video'))
        video.currentTime = Math.min(0.1, video.duration / 2)
      })
    }

    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth || 1, video.videoHeight || 1))
    const width = Math.max(1, Math.round((video.videoWidth || 1) * scale))
    const height = Math.max(1, Math.round((video.videoHeight || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    const response = await fetch(dataUrl)
    return await response.blob()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function readTextBlob(blob: Blob): Promise<string> {
  return blob.text()
}
