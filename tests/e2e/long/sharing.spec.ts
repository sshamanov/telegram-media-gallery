import { test, expect } from '../shared/fixtures';

test.describe('Sharing & Forwarding @long', () => {
  test.beforeEach(async ({ galleryPage }) => {
    // Navigate to gallery view
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();
    await expect(galleryPage.getByRole('heading', { name: /gallery|media/i })).toBeVisible({ timeout: 10000 });
    
    // Wait for media items to load
    await expect(galleryPage.locator('[data-testid="media-item"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('share button is visible on media item', async ({ galleryPage }) => {
    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await firstMediaItem.hover();
    
    // Look for share button
    const shareButton = galleryPage.getByRole('button', { name: /share|forward|send/i });
    await expect(shareButton).toBeVisible();
  });

  test('share dialog opens', async ({ galleryPage }) => {
    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await firstMediaItem.hover();
    
    const shareButton = galleryPage.getByRole('button', { name: /share|forward|send/i });
    await shareButton.click();
    
    // Share dialog should open
    await expect(galleryPage.getByRole('dialog').or(galleryPage.getByText(/share.*with|forward.*to/i))).toBeVisible({ timeout: 5000 });
  });

  test('forward to dialog selection works', async ({ galleryPage }) => {
    const firstMediaItem = galleryPage.locator('[data-testid="media-item"]').first();
    await firstMediaItem.hover();
    
    const shareButton = galleryPage.getByRole('button', { name: /share|forward|send/i });
    await shareButton.click();
    
    // Should see dialog list for forwarding
    await expect(galleryPage.getByText(/select.*dialog|choose.*chat/i)).toBeVisible();
    await expect(galleryPage.locator('[data-testid="dialog-item"]')).toBeVisible();
  });

  test('bulk action menu for sharing', async ({ galleryPage }) => {
    // Select multiple items
    const mediaItems = galleryPage.locator('[data-testid="media-item"]');
    const count = await mediaItems.count();
    
    if (count >= 2) {
      await mediaItems.nth(0).click();
      await mediaItems.nth(1).click({ modifiers: ['Shift'] });
      
      // Look for bulk share option
      await expect(galleryPage.getByRole('button', { name: /share.*selected|forward.*all/i })).toBeVisible();
    }
  });
});