import { test, expect } from '../shared/fixtures';

test.describe('Download Flow @long', () => {
  test.beforeEach(async ({ galleryPage }) => {
    // Navigate to gallery view
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();
    await expect(galleryPage.getByRole('heading', { name: /gallery|media/i })).toBeVisible({ timeout: 10000 });
    
    // Wait for media items to load
    await expect(galleryPage.locator('[data-testid="media-item"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('download button is visible on media item', async ({ galleryPage }) => {
    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    
    // Hover or open context menu to reveal download button
    await firstMediaItem.hover();
    
    // Look for download button in the item or context menu
    const downloadButton = galleryPage.getByRole('button', { name: /download|save/i });
    await expect(downloadButton).toBeVisible();
  });

  test('download action triggers', async ({ galleryPage }) => {
    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await firstMediaItem.hover();
    
    const downloadButton = galleryPage.getByRole('button', { name: /download|save/i });
    await downloadButton.click();
    
    // Check for download confirmation or progress
    await expect(galleryPage.getByText(/downloading|saving/i)).toBeVisible({ timeout: 5000 });
  });

  test('multiple item selection for download', async ({ galleryPage }) => {
    // Select multiple items (checkboxes or shift+click)
    const mediaItems = galleryPage.locator('[data-testid="media-item"]');
    const count = await mediaItems.count();
    
    if (count >= 2) {
      // Try to select first two items
      await mediaItems.nth(0).click();
      await mediaItems.nth(1).click({ modifiers: ['Shift'] });
      
      // Look for bulk download option
      await expect(galleryPage.getByRole('button', { name: /download.*selected|save.*all/i })).toBeVisible();
    }
  });
});