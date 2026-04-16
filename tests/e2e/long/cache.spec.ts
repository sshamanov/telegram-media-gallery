import { test, expect, loginWithMockPhone } from '../shared/fixtures'

interface SeedEntry {
  id: string
  mimeType: string
  body: string
}

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /settings|gear|cog/i }).click()
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 5000 })
}

async function prepareStorage(page: import('@playwright/test').Page, options?: {
  disableOpfs?: boolean
  fullMediaEntries?: SeedEntry[]
}): Promise<void> {
  await page.addInitScript(async ({ disableOpfs, fullMediaEntries }) => {
    const storage = navigator.storage as StorageManager & {
      getDirectory?: StorageManager['getDirectory']
    }
    const originalGetDirectory = typeof storage.getDirectory === 'function'
      ? storage.getDirectory.bind(storage)
      : undefined

    if (disableOpfs && sessionStorage.getItem('__restoreOpfsForTests') !== '1') {
      Object.defineProperty(storage, 'getDirectory', {
        configurable: true,
        writable: true,
        value: undefined,
      })

      Object.defineProperty(window, '__restoreOpfsForTests', {
        configurable: true,
        value: () => {
          sessionStorage.setItem('__restoreOpfsForTests', '1')
          Object.defineProperty(storage, 'getDirectory', {
            configurable: true,
            writable: true,
            value: originalGetDirectory,
          })
        },
      })
    }

    localStorage.removeItem('full-media-storage-v1')

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('telegram-gallery-cache')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to reset cache database'))
      request.onblocked = () => resolve()
    })

    if (!fullMediaEntries?.length) {
      return
    }

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
        const tx = db.transaction('full-media', 'readwrite')
        const store = tx.objectStore('full-media')

        for (const entry of fullMediaEntries) {
          store.put({
            id: entry.id,
            blob: new Blob([entry.body], { type: entry.mimeType }),
            updatedAt: Date.now(),
          })
        }

        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error ?? new Error('Failed to seed full-media cache'))
        tx.onabort = () => reject(tx.error ?? new Error('Failed to seed full-media cache'))
      }

      request.onerror = () => reject(request.error ?? new Error('Failed to open cache database'))
    })
  }, options ?? {})
}

test.describe('Cache Management @long', () => {
  test.describe.configure({ mode: 'serial' })

  test('storage section renders in settings', async ({ galleryPage }) => {
    await openSettings(galleryPage)
    await expect(galleryPage.locator('fieldset').filter({ hasText: 'Storage' })).toBeVisible()
    await expect(galleryPage.getByTestId('full-media-backend-status')).toBeVisible()
  })

  test('full-media migration resumes after an IndexedDB fallback session', async ({ page }) => {
    await prepareStorage(page, {
      disableOpfs: true,
      fullMediaEntries: [
        { id: 'cache-dialog:101:full', mimeType: 'image/jpeg', body: 'resume-me' },
      ],
    })

    await page.goto('/')
    await loginWithMockPhone(page)
    await openSettings(page)

    await expect(page.getByTestId('full-media-backend-status')).toHaveText('IndexedDB fallback')
    await expect(page.getByTestId('full-media-migration-status')).toContainText('OPFS API is unavailable')
    await expect(page.getByTestId('full-media-primary-row')).toContainText('1 items')

    await page.evaluate(() => {
      ;(window as Window & { __restoreOpfsForTests?: () => void }).__restoreOpfsForTests?.()
    })
    await page.reload()
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })

    await expect(page.getByTestId('full-media-backend-status')).toHaveText('OPFS')
    await expect(page.getByTestId('full-media-migration-status')).toContainText('migrated to OPFS')
    await expect(page.getByTestId('full-media-primary-row')).toContainText('1 items')
    await expect(page.getByTestId('full-media-legacy-row')).toContainText('0 items')
  })

  test('partial migration failures stay visible as legacy IndexedDB entries', async ({ page }) => {
    await prepareStorage(page, {
      fullMediaEntries: [
        { id: 'broken-entry', mimeType: 'image/jpeg', body: 'cannot-migrate' },
      ],
    })

    await page.goto('/')
    await loginWithMockPhone(page)
    await openSettings(page)

    await expect(page.getByTestId('full-media-backend-status')).toHaveText('OPFS')
    await expect(page.getByTestId('full-media-migration-status')).toContainText('remain in IndexedDB')
    await expect(page.getByTestId('full-media-primary-row')).toContainText('0 items')
    await expect(page.getByTestId('full-media-legacy-row')).toContainText('1 items')
  })

  test('settings explain that offline export and relay actions remain disabled', async ({ galleryPage }) => {
    await openSettings(galleryPage)
    await expect(galleryPage.getByTestId('offline-actions-status')).toContainText('downloads stay disabled')
    await expect(galleryPage.getByTestId('offline-actions-status')).toContainText('forwarding stays disabled')
    await expect(galleryPage.getByTestId('offline-actions-status')).toContainText('sharing stays disabled')
  })
})
