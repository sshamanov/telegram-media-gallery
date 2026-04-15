import { test, expect, waitForServiceWorkerReady } from '../shared/fixtures'

test.describe('Offline app shell @long', () => {
  test.skip(process.env.PLAYWRIGHT_SERVER_MODE !== 'production', 'requires production preview server')

  test('loads the cached shell after an online visit', async ({ page, context }) => {
    await page.goto('/')
    await expect(page.getByTestId('auth-screen')).toBeVisible()

    await waitForServiceWorkerReady(page)

    const registrationState = await page.evaluate(async () => {
      return {
        cacheKeys: await caches.keys(),
      }
    })

    expect(registrationState.cacheKeys.some((key) => key.startsWith('app-shell-'))).toBe(true)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('auth-screen')).toBeVisible()

    const offlineState = await page.evaluate(async () => ({
      controlled: Boolean(navigator.serviceWorker.controller),
      online: navigator.onLine,
      cacheKeys: await caches.keys(),
    }))

    expect(offlineState.controlled).toBe(true)
    expect(offlineState.online).toBe(false)
    expect(offlineState.cacheKeys.some((key) => key.startsWith('app-shell-'))).toBe(true)
  })
})
