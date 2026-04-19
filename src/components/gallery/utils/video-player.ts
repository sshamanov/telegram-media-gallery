import { debugWarn } from '../../../lib/debug'

export function createVideoPlayer(
  container: HTMLElement,
  mediaUrl: string,
  options: {
    autoplay?: boolean
    controls?: boolean
    playsInline?: boolean
    onPlay?: () => void
    onPause?: () => void
    onEnded?: () => void
  } = {}
): {
  videoElement: HTMLVideoElement
  play: () => Promise<void>
  pause: () => void
  requestFullscreen: () => Promise<void>
  destroy: () => void
} {
  const {
    autoplay = false,
    controls = true,
    playsInline = true,
    onPlay,
    onPause,
    onEnded
  } = options

  const video = document.createElement('video')
  video.className = 'viewer-video'
  video.controls = controls
  video.playsInline = playsInline
  video.src = mediaUrl
  
  if (autoplay) {
    video.autoplay = true
  }

  if (onPlay) {
    video.addEventListener('play', onPlay)
  }

  if (onPause) {
    video.addEventListener('pause', onPause)
  }

  if (onEnded) {
    video.addEventListener('ended', onEnded)
  }

  container.appendChild(video)

  const play = async (): Promise<void> => {
    try {
      await video.play()
    } catch (error) {
      debugWarn('Video play failed:', error)
    }
  }

  const pause = (): void => {
    video.pause()
  }

  const requestFullscreen = async (): Promise<void> => {
    if (video.requestFullscreen) {
      await video.requestFullscreen()
    }
  }

  const destroy = (): void => {
    video.pause()
    video.src = ''
    video.load()
    
    if (onPlay) {
      video.removeEventListener('play', onPlay)
    }
    if (onPause) {
      video.removeEventListener('pause', onPause)
    }
    if (onEnded) {
      video.removeEventListener('ended', onEnded)
    }
    
    if (container.contains(video)) {
      container.removeChild(video)
    }
  }

  return {
    videoElement: video,
    play,
    pause,
    requestFullscreen,
    destroy
  }
}

export function createVideoContainer(className: string = 'viewer-video-wrap pswp__content'): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.className = className
  return wrapper
}