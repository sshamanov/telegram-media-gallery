import { test as base, expect, type Page } from '@playwright/test'

export async function loginWithMockPhone(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="auth-screen"]', { timeout: 5000 })
  await page.getByRole('tab', { name: /phone/i }).click()
  await page.getByTestId('phone-input').fill('1234567890')
  await page.getByTestId('send-code-button').click()
  await page.waitForSelector('[data-auth-step="code"]', { timeout: 5000 })
  await page.getByTestId('verification-code-input').fill('000000')
  await page.getByTestId('submit-code-button').click()
  await page.waitForSelector('[data-testid="dialogs-screen"]', { timeout: 10000 })
}

export async function waitForServiceWorkerReady(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return false
    }

    const registration = await navigator.serviceWorker.getRegistration()
    const cacheKeys = await caches.keys()
    return Boolean(registration?.active) && cacheKeys.some((key) => key.startsWith('app-shell-'))
  }), { timeout: 15000 }).toBe(true)
}

export const test = base.extend<{
  authPage: Page
  galleryPage: Page
}>({
  authPage: async ({ page }, use) => {
    await page.goto('/')
    await use(page)
  },

  galleryPage: async ({ page }, use) => {
    await page.goto('/')
    await loginWithMockPhone(page)
    await use(page)
  },
})

export { expect }
