# Telegram Media Gallery

An offline-capable PWA that browses the photos and videos in your Telegram chats, groups and channels as a gallery. It talks to Telegram directly from the browser over MTProto ([mtcute](https://github.com/mtcute/mtcute)), with no backend server.

Built with Svelte 5, TypeScript, Vite and PhotoSwipe.

## Features

- Log in with a phone code or QR code
- Browse dialogs as a media grid; fullscreen viewer with keyboard and swipe navigation
- Multi-select, bulk download and forwarding to other chats
- Upload with background sync
- Offline cache and search (IndexedDB + service worker), pull-to-refresh
- Mock adapter for development and Playwright end-to-end tests

## Setup

1. Create an application at https://my.telegram.org/apps and note its `api_id` and `api_hash`.
2. Copy `.env.example` to `.env` and fill in `VITE_TELEGRAM_API_ID` and `VITE_TELEGRAM_API_HASH`.
3. Run:

```sh
npm install
npm run dev
```

Set `VITE_USE_MOCK_ADAPTER=1` to run against mock data without a Telegram account.

Production build: `npm run build`, then `npm run serve:dist`.

## Docker

A prebuilt image is published to GHCR. Telegram credentials are passed as environment variables at container start, not baked into the image:

```sh
docker run -d -p 4173:4173 \
  -e TELEGRAM_API_ID=123456 \
  -e TELEGRAM_API_HASH=0123456789abcdef0123456789abcdef \
  ghcr.io/sshamanov/telegram-media-gallery:latest
```

The server exposes them to the browser via `/config.js`. If they are not set, the login screen asks the user for their own `api_id`/`api_hash`.

Build locally with `docker build -f Dockerfile.prod -t telegram-gallery .`.

## Security notes

- The `api_id`/`api_hash` (whether from `TELEGRAM_API_*` at runtime or `VITE_*` at build time) are delivered to the browser, so they are visible to anyone who can load the app. This is inherent to browser Telegram clients; host your own instance.
- The Telegram session is stored in the browser's `localStorage`. Log out on shared devices.

## Tests

```sh
npm run test:install-browsers
npm run test:short
```

## License

MIT
