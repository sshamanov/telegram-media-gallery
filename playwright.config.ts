import { defineConfig, devices } from '@playwright/test'

const isContainerMode = process.env.PLAYWRIGHT_CONTAINER_MODE === 'true'
const serverMode = process.env.PLAYWRIGHT_SERVER_MODE === 'production' ? 'production' : 'development'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || (serverMode === 'production' ? 'http://127.0.0.1:5173' : 'https://localhost:5173')
const ignoreHTTPSErrors = baseURL.startsWith('https://')

const webServer = {
  command: serverMode === 'production'
    ? 'npm run build && npm run serve:dist -- --host 0.0.0.0 --port 5173'
    : 'npm run dev -- --host 0.0.0.0 --port 5173',
  url: baseURL,
  reuseExistingServer: serverMode !== 'production' && !process.env.CI,
  timeout: 120 * 1000,
  ignoreHTTPSErrors,
  env: {
    VITE_USE_MOCK_ADAPTER: 'true',
  },
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  ...(isContainerMode ? {} : { webServer }),
})
