import { mount } from 'svelte'
import 'photoswipe/style.css'
import App from './App.svelte'
import './app.css'
import { debugWarn } from './lib/debug'

const target = document.getElementById('app')

if (!target) {
  throw new Error('Missing #app mount target')
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    debugWarn('service-worker:register-failed', error)
  })
}

mount(App, { target })
