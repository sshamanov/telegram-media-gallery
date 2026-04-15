import { test, expect, loginWithMockPhone, waitForServiceWorkerReady } from '../shared/fixtures'

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

  test('renders persisted dialogs from the last synced snapshot while offline', async ({ page, context }) => {
    await page.goto('/')
    await loginWithMockPhone(page)
    await expect(page.getByTestId('dialogs-screen')).toBeVisible()
    await expect(page.locator('[data-testid="dialog-item"]').first()).toBeVisible()
    await waitForServiceWorkerReady(page)

    const persistedState = await page.evaluate(() => {
      const snapshot = localStorage.getItem('dialogs.snapshot')
      return snapshot ? JSON.parse(snapshot) as { updatedAt: number | null; dialogs: Array<{ title: string }> } : null
    })

    expect(persistedState).not.toBeNull()
    expect(persistedState?.dialogs.length ?? 0).toBeGreaterThan(0)
    expect(persistedState?.dialogs[0]?.title).toBe('Personal Gallery')

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('offline-banner')).toHaveAttribute('data-offline-mode', 'cached')
    await expect(page.getByTestId('dialogs-screen')).toBeVisible()
    await expect(page.getByTestId('dialog-list')).toHaveAttribute('data-dialog-source', 'snapshot')
    await expect(page.getByTestId('dialogs-data-status')).toContainText('Offline - showing last synced dialogs')
    await expect(page.getByText('Personal Gallery')).toBeVisible()
  })
})
