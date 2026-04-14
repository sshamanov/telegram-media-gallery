import { defineConfig, devices } from '@playwright/test';

// Determine if running in container mode (Playwright container connecting to external app server)
const isContainerMode = process.env.PLAYWRIGHT_CONTAINER_MODE === 'true';

const config = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
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
};

// Only include webServer configuration when NOT in container mode
// In container mode, the app service already runs the server
if (!isContainerMode) {
  config.webServer = {
    command: 'npm run dev',
    url: 'https://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    ignoreHTTPSErrors: true,
    env: {
      VITE_USE_MOCK_ADAPTER: 'true',
    },
  };
}

export default defineConfig(config);