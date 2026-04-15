import { test, expect } from '../shared/fixtures';

test.describe('Fullscreen Viewer @short', () => {
  test.beforeEach(async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await expect(firstDialog).toBeVisible({ timeout: 5000 });
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });
    await firstMediaItem.click();

    await expect(galleryPage.locator('.pswp')).toBeVisible({ timeout: 5000 });
  });

  test('PhotoSwipe viewer opens', async ({ galleryPage }) => {
    await expect(galleryPage.locator('.pswp__container')).toBeVisible();
  });

  test('navigation arrows are visible', async ({ galleryPage }) => {
    await expect(galleryPage.locator('.nav.left')).toBeVisible();
    await expect(galleryPage.locator('.nav.right')).toBeVisible();
  });

  test('close button returns to gallery', async ({ galleryPage }) => {
    const closeButton = galleryPage.getByRole('button', { name: /close|✕/i }).first();
    await closeButton.click();

    await expect(galleryPage.locator('.viewer-ui')).not.toBeVisible({ timeout: 5000 });
    await expect(galleryPage.getByTestId('gallery-root')).toBeVisible();
  });
});
