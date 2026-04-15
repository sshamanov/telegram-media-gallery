import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import basicSsl from '@vitejs/plugin-basic-ssl'

const SERVICE_WORKER_VERSION_TOKEN = '__APP_SHELL_CACHE_VERSION__'
const SERVICE_WORKER_PRECACHE_TOKEN = '__APP_SHELL_PRECACHE_URLS__'

function serviceWorkerPrecachePlugin(): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    name: 'service-worker-precache',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config
    },
    async writeBundle(_options, bundle) {
      const precacheUrls = Array.from(new Set([
        '/',
        '/index.html',
        ...Object.keys(bundle)
          .filter((fileName) => fileName.endsWith('.js') || fileName.endsWith('.css'))
          .map((fileName) => `/${fileName}`),
      ])).sort()

      const cacheVersion = createHash('sha256')
        .update(JSON.stringify(precacheUrls))
        .digest('hex')
        .slice(0, 12)

      const templatePath = path.resolve(resolvedConfig.root, 'public/sw.js')
      const outputPath = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, 'sw.js')
      const serviceWorkerTemplate = await readFile(templatePath, 'utf8')
      const renderedServiceWorker = serviceWorkerTemplate
        .replace(SERVICE_WORKER_VERSION_TOKEN, cacheVersion)
        .replace(SERVICE_WORKER_PRECACHE_TOKEN, JSON.stringify(precacheUrls, null, 2))

      await writeFile(outputPath, renderedServiceWorker)
    },
  }
}

export default defineConfig({
  plugins: [svelte(), basicSsl(), serviceWorkerPrecachePlugin()],
  optimizeDeps: {
    exclude: ['@mtcute/wasm'],
    entries: ['index.html'],
  },
  build: {
    rollupOptions: {
      // External dependencies configuration
    },
  },
})
