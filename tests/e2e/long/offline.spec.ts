import { test, expect, loginWithMockPhone, waitForServiceWorkerReady } from '../shared/fixtures'

const TINY_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY6zWQAAAABJRU5ErkJggg=='

async function openPersonalGallery(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('dialog-item').first().click()
  await expect(page.getByTestId('gallery-screen')).toBeVisible()
}

async function filterToPhotos(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('gallery-filter-photos').click()
  await expect(page.getByTestId('gallery-grid')).toBeVisible()
}

async function seedOfflineMediaCache(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(async ({ tinyImageBase64 }) => {
    function createImageBlob(): Blob {
      const binary = atob(tinyImageBase64)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }

      return new Blob([bytes], { type: 'image/png' })
    }

    localStorage.removeItem('full-media-storage-v1')

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('telegram-gallery-cache')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to reset cache database'))
      request.onblocked = () => resolve()
    })

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('telegram-gallery-cache', 1)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('full-media')) {
          db.createObjectStore('full-media', { keyPath: 'id' })
        }
      }

      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(['thumbnails', 'full-media'], 'readwrite')
        const thumbs = tx.objectStore('thumbnails')
        const fullMedia = tx.objectStore('full-media')
        const imageBlob = createImageBlob()

        thumbs.put({ id: '1:1000:thumb', blob: imageBlob, updatedAt: Date.now() })
        thumbs.put({ id: '1:1003:thumb', blob: imageBlob, updatedAt: Date.now() })
        fullMedia.put({ id: '1:1000:full', blob: imageBlob, updatedAt: Date.now() })

        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error ?? new Error('Failed to seed offline media cache'))
        tx.onabort = () => reject(tx.error ?? new Error('Failed to seed offline media cache'))
      }

      request.onerror = () => reject(request.error ?? new Error('Failed to open cache database'))
    })
  }, { tinyImageBase64: TINY_IMAGE_BASE64 })
}

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

  test('keeps cached gallery thumbnails visible after going offline in-session', async ({ page, context }) => {
    await page.goto('/')
    await loginWithMockPhone(page)
    await waitForServiceWorkerReady(page)
    await openPersonalGallery(page)
    await filterToPhotos(page)

    const firstPhoto = page.getByTestId('media-item').first()
    const firstPhotoImage = firstPhoto.locator('img')
    await expect(firstPhotoImage).toBeVisible({ timeout: 10000 })

    await context.setOffline(true)

    await expect(page.getByTestId('gallery-data-status')).toContainText('cached thumbnails remain visible')
    await expect(firstPhotoImage).toBeVisible()
  })

  test('shows cached full media offline and placeholder for uncached full media', async ({ page, context }) => {
    await seedOfflineMediaCache(page)
    await page.goto('/')
    await loginWithMockPhone(page)
    await waitForServiceWorkerReady(page)
    await openPersonalGallery(page)
    await filterToPhotos(page)

    const firstPhoto = page.getByTestId('media-item').nth(0)
    await expect(firstPhoto.locator('img')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('media-item').nth(1).locator('img')).toBeVisible({ timeout: 10000 })

    await context.setOffline(true)

    await firstPhoto.click()
    await expect(page.locator('.pswp')).toBeVisible({ timeout: 10000 })
    await expect.poll(async () => page.locator('.caption').textContent()).toContain('1 / 4')
    await expect(page.locator('[data-testid="viewer-offline-placeholder"]:visible')).toHaveCount(0)
    await page.getByRole('button', { name: 'Next media' }).click()
    await expect.poll(async () => page.locator('.caption').textContent()).toContain('2 / 4')
    await expect.poll(async () => page.locator('[data-testid="viewer-offline-placeholder"]:visible').count()).toBeGreaterThan(0)
    await expect(page.getByText('Not available offline').first()).toBeVisible()
  })

  test('disables offline download, forward, and share actions in the gallery and viewer', async ({ page, context }) => {
    await seedOfflineMediaCache(page)
    await page.goto('/')
    await loginWithMockPhone(page)
    await waitForServiceWorkerReady(page)
    await openPersonalGallery(page)
    await filterToPhotos(page)

    await page.getByTestId('media-item').first().click({ modifiers: ['ControlOrMeta'] })
    await expect(page.getByTestId('gallery-selection-header')).toBeVisible()

    await context.setOffline(true)

    await expect(page.getByTestId('gallery-selection-download')).toBeDisabled()
    await expect(page.getByTestId('gallery-selection-forward')).toBeDisabled()
    await expect(page.getByTestId('gallery-selection-share')).toBeDisabled()
    await expect(page.getByTestId('gallery-offline-actions-status')).toContainText('disabled offline')

    await page.getByTestId('gallery-selection-cancel').click()
    await page.getByTestId('media-item').first().click()
    await expect(page.locator('.pswp')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '⬇' })).toBeDisabled()
    if (await page.getByRole('button', { name: '↑' }).count() > 0) {
      await expect(page.getByRole('button', { name: '↑' })).toBeDisabled()
    }
  })
})
