/**
 * Telegram Gallery — Service Worker (Phase 3)
 *
 * Strategy:
 *  - App shell (HTML + JS + CSS chunks): Cache First, updated on each SW version bump
 *  - Thumbnail API requests: Cache First (IndexedDB handles this in-app; SW caches
 *    the fetch responses for URL-based thumbnail requests if any)
 *  - Everything else (Telegram API, MTProto): Network only — never intercept
 *
 * Cache versioning: bump CACHE_VERSION whenever you deploy a new build so old
 * assets are purged on SW activation.
 */

// Injected by Vite build via vite-plugin-pwa or manual build step.
// In dev mode this list is empty — SW installs but does nothing special.
// In production the build script replaces this comment with the real asset list.
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `shell-${CACHE_VERSION}`
const THUMB_CACHE = `thumbs-${CACHE_VERSION}`

/** Assets precached on install. Populated by build step. */
const PRECACHE_URLS = [
  '/',
  '/index.html',
]

// ── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

// ── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== THUMB_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept non-GET, chrome-extension, or cross-origin Telegram API calls
  if (
    request.method !== 'GET'
    || url.protocol === 'chrome-extension:'
    || url.hostname.endsWith('.telegram.org')
    || url.hostname.endsWith('.t.me')
  ) {
    return
  }

  // App shell: Cache First, fall back to network
  if (
    url.origin === self.location.origin
    && (url.pathname === '/' || url.pathname.startsWith('/assets/') || url.pathname.endsWith('.html'))
  ) {
    event.respondWith(cacheFirst(SHELL_CACHE, request))
    return
  }

  // Thumbnail fetches (if any — most are handled in-app via IndexedDB blobs)
  if (url.pathname.includes('/thumb/')) {
    event.respondWith(cacheFirst(THUMB_CACHE, request))
    return
  }

  // All other same-origin requests: network only
})

async function cacheFirst(cacheName, request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Offline and not cached — return a minimal offline response for HTML
    if (request.headers.get('Accept')?.includes('text/html')) {
      const cached = await caches.match('/')
      if (cached) return cached
    }
    return new Response('Offline', { status: 503 })
  }
}
