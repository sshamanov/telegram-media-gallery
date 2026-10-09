import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key.startsWith('--') && value) {
    args.set(key.slice(2), value)
    index += 1
  }
}

const host = args.get('host') || process.env.HOST || '127.0.0.1'
const port = Number(args.get('port') || process.env.PORT || '5173')
const distRoot = path.resolve(process.cwd(), 'dist')
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
])

// Runtime client config, read from the container environment at startup.
const runtimeConfigScript = `window.__APP_CONFIG__ = ${JSON.stringify({
  telegramApiId: process.env.TELEGRAM_API_ID || '',
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',
})}\n`

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    if (requestUrl.pathname === '/config.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
      })
      response.end(runtimeConfigScript)
      return
    }

    const candidatePath = requestUrl.pathname === '/'
      ? '/index.html'
      : requestUrl.pathname
    const normalizedPath = path.normalize(candidatePath).replace(/^([.][.][/\\])+/, '')
    let filePath = path.join(distRoot, normalizedPath)

    try {
      const body = await readFile(filePath)
      const cacheControl = normalizedPath === '/sw.js' || normalizedPath.endsWith('.html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable'
      response.writeHead(200, {
        'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream',
        'Cache-Control': cacheControl,
      })
      response.end(body)
      return
    } catch {
      if (path.extname(normalizedPath)) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Not found')
        return
      }
    }

    filePath = path.join(distRoot, 'index.html')
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    })
    response.end(body)
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Internal server error')
  }
})

server.listen(port, host, () => {
  process.stdout.write(`Serving dist on http://${host}:${port}\n`)
})
