import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { debugLog, debugWarn } from './lib/debug'
import { processQueue } from './lib/upload/queue'

const target = document.getElementById('app')

if (!target) {
  throw new Error('Missing #app mount target')
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    debugWarn('service-worker:register-failed', error)
  })
  
  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PROCESS_UPLOAD_QUEUE') {
      debugLog('main: processing upload queue from service worker sync')
      void processQueue().then(() => {
        // Notify service worker that queue was processed
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'UPLOAD_QUEUE_PROCESSED'
          })
        }
      })
    }
  })
}

mount(App, { target })
