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

  test('ctrl/meta click enters selection mode', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Use Ctrl key (works on Windows/Linux, Meta would be for Mac but Ctrl also works)
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();
    await expect(galleryPage.getByTestId('gallery-selection-count')).toContainText('1 of');
  });

  test('selection mode: toggle item off/on', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();

    // Click again to toggle off
    await firstMediaItem.click();
    await expect(galleryPage.getByTestId('gallery-selection-count')).toContainText('0 of');

    // Click again to toggle on
    await firstMediaItem.click();
    await expect(galleryPage.getByTestId('gallery-selection-count')).toContainText('1 of');
  });

  test('selection mode: select all visible items', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();

    // Click select all
    await galleryPage.getByTestId('gallery-selection-select-all').click();

    // Count visible items
    const visibleCount = await galleryPage.locator('[data-testid="media-item"]').count();
    await expect(galleryPage.getByTestId('gallery-selection-count')).toContainText(`${visibleCount} of ${visibleCount} visible items selected`);
  });

  test('selection mode: cancel exits selection mode', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();

    // Click cancel
    await galleryPage.getByTestId('gallery-selection-cancel').click();

    // Should be back to normal header
    await expect(galleryPage.getByTestId('gallery-back-button')).toBeVisible();
    await expect(galleryPage.getByTestId('gallery-selection-header')).not.toBeVisible();
  });
});
