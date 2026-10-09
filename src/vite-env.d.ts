/// <reference types="vite/client" />

declare global {
  interface Window {
    __APP_CONFIG__?: { telegramApiId?: string; telegramApiHash?: string }
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandle>
  }
}

export {}
