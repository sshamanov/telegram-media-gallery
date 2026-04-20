const CACHE_VERSION = '__APP_SHELL_CACHE_VERSION__'
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`
const APP_SHELL_CACHE_PREFIX = 'app-shell-'
const LEGACY_CACHE_PREFIXES = ['shell-', 'thumbs-']
const PRECACHE_URLS = __APP_SHELL_PRECACHE_URLS__

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE)
    await cache.addAll(PRECACHE_URLS)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys()
    await Promise.all(
      cacheKeys
        .filter((cacheKey) => {
          if (cacheKey === APP_SHELL_CACHE) {
            return false
          }

          return cacheKey.startsWith(APP_SHELL_CACHE_PREFIX)
            || LEGACY_CACHE_PREFIXES.some((prefix) => cacheKey.startsWith(prefix))
        })
        .map((cacheKey) => caches.delete(cacheKey)),
    )

    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request))
    return
  }

  if (isAppShellAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
})

function isAppShellAsset(pathname) {
  return pathname === '/' || pathname === '/index.html' || pathname.startsWith('/assets/')
}

async function handleNavigationRequest(request) {
  const cachedShell = await caches.match('/') || await caches.match('/index.html')
  if (cachedShell) {
    return cachedShell
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE)
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(APP_SHELL_CACHE)
    await cache.put(request, response.clone())
  }

  return response
}

// Background sync for uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'upload-queue') {
    event.waitUntil(handleUploadSync())
  }
})

async function handleUploadSync() {
  try {
    // Get all clients to send message
    const clients = await self.clients.matchAll()
    
    // Send message to client to process upload queue
    clients.forEach((client) => {
      client.postMessage({
        type: 'PROCESS_UPLOAD_QUEUE'
      })
    })
    
    console.log('[Service Worker] Sync event triggered for upload-queue')
  } catch (error) {
    console.error('[Service Worker] Failed to handle upload sync:', error)
  }
}

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPLOAD_QUEUE_PROCESSED') {
    console.log('[Service Worker] Upload queue processed by client')
  }
})
