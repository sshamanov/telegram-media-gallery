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

  test('selection mode: download button appears when items selected', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();
    
    // Download button should be visible and enabled
    const downloadButton = galleryPage.getByTestId('gallery-selection-download');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();
  });

  test('selection mode: download button disabled when no items selected', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();
    
    // Click to deselect
    await firstMediaItem.click();
    
    // Download button should be disabled
    const downloadButton = galleryPage.getByTestId('gallery-selection-download');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeDisabled();
  });

  test('selection mode: download panel appears when download starts', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();
    
    // Click download button
    await galleryPage.getByTestId('gallery-selection-download').click();
    
    // Download panel should appear
    await expect(galleryPage.getByTestId('gallery-download-panel')).toBeVisible({ timeout: 5000 });
    
    // Should show download status
    await expect(galleryPage.locator('.download-status')).toBeVisible();
  });

  test('selection mode: forward button appears when items selected', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();
    
    // Forward button should be visible and enabled
    const forwardButton = galleryPage.getByTestId('gallery-selection-forward');
    await expect(forwardButton).toBeVisible();
    await expect(forwardButton).toBeEnabled();
  });

  test('selection mode: forward button disabled when no items selected', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();
    
    // Click to deselect
    await firstMediaItem.click();
    
    // Forward button should be disabled
    const forwardButton = galleryPage.getByTestId('gallery-selection-forward');
    await expect(forwardButton).toBeVisible();
    await expect(forwardButton).toBeDisabled();
  });

  test('selection mode: forward opens dialog picker', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await expect(firstMediaItem).toBeVisible({ timeout: 5000 });

    // Enter selection mode with ctrl click
    await galleryPage.keyboard.down('Control');
    await firstMediaItem.click();
    await galleryPage.keyboard.up('Control');

    await expect(galleryPage.getByTestId('gallery-selection-header')).toBeVisible();
    
    // Click forward button
    await galleryPage.getByTestId('gallery-selection-forward').click();
    
    // Dialog picker should appear
    await expect(galleryPage.getByTestId('dialog-picker-search')).toBeVisible({ timeout: 5000 });
  });

  test('grid columns button cycles through values', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    await expect(galleryPage.getByTestId('gallery-screen')).toBeVisible({ timeout: 10000 });
    
    const columnsButton = galleryPage.getByTestId('gallery-grid-columns-button');
    await expect(columnsButton).toBeVisible();
    
    // Get initial value
    const initialText = await columnsButton.textContent();
    expect(initialText).toMatch(/^\d+x$/);
    
    // Click to cycle
    await columnsButton.click();
    
    // Should have changed
    const afterClickText = await columnsButton.textContent();
    expect(afterClickText).toMatch(/^\d+x$/);
    expect(afterClickText).not.toBe(initialText);
    
    // Grid should have updated columns
    const grid = galleryPage.getByTestId('gallery-grid');
    await expect(grid).toBeVisible();
    
    // Click a few more times to cycle through values
    for (let i = 0; i < 3; i++) {
      await columnsButton.click();
    }
    
    // Should still be a valid columns value
    const finalText = await columnsButton.textContent();
    expect(finalText).toMatch(/^\d+x$/);
  });

  test('mock media thumbnails render actual images', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();

    await expect(galleryPage.getByTestId('gallery-screen')).toBeVisible({ timeout: 10000 });
    
    // Wait for media items to load
    const mediaItems = galleryPage.locator('[data-testid="media-item"]');
    await expect(mediaItems.first()).toBeVisible({ timeout: 5000 });
    
    // Check that at least one media item has an actual image (not just icon placeholder)
    // We look for img elements inside media items
    const firstMediaItem = mediaItems.first();
    const imgElement = firstMediaItem.locator('img');
    
    // The img should be visible and have a src
    await expect(imgElement).toBeVisible({ timeout: 3000 });
    const src = await imgElement.getAttribute('src');
    expect(src).toBeTruthy();
    
    // The src should be a data URL or blob URL (not empty)
    expect(src?.length).toBeGreaterThan(0);
  });
});
