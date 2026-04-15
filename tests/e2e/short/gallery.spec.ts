import { test, expect } from '../shared/fixtures';

test.describe('Gallery View @short', () => {
  test('media grid/list loads', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await expect(firstDialog).toBeVisible({ timeout: 5000 });
    await firstDialog.click();

    await expect(galleryPage.getByTestId('gallery-screen')).toBeVisible({ timeout: 10000 });
    await expect(galleryPage.getByTestId('gallery-root')).toBeVisible();
    await expect(galleryPage.locator('[data-testid="media-item"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('filter bar with media types is visible', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    await expect(galleryPage.getByTestId('gallery-filter-bar')).toBeVisible();
    await expect(galleryPage.getByTestId('gallery-filter-all')).toBeVisible();
    await expect(galleryPage.getByTestId('gallery-filter-photos')).toBeVisible();
    await expect(galleryPage.getByTestId('gallery-filter-videos')).toBeVisible();
    await expect(galleryPage.getByTestId('gallery-filter-docs')).toBeVisible();
  });

  test('view mode toggle (grid/list) works', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const toggle = galleryPage.getByTestId('gallery-view-toggle');
    await expect(toggle).toBeVisible();
    await expect(galleryPage.getByTestId('gallery-grid')).toBeVisible();

    await toggle.click();
    await expect(galleryPage.getByTestId('gallery-list')).toBeVisible();

    await toggle.click();
    await expect(galleryPage.getByTestId('gallery-grid')).toBeVisible();
  });

  test('click media item opens fullscreen viewer', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });
    await firstMediaItem.click();

    await expect(galleryPage.locator('.pswp')).toBeVisible({ timeout: 5000 });
  });
});
