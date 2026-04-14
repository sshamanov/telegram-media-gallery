import { test, expect } from '../shared/fixtures';

test.describe('Cache Management @long', () => {
  test.beforeEach(async ({ galleryPage }) => {
    // Open settings
    const settingsButton = galleryPage.getByRole('button', { name: /settings|gear|cog/i });
    await settingsButton.click();
    await expect(galleryPage.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 5000 });
  });

  test('cache management section is visible', async ({ galleryPage }) => {
    await expect(galleryPage.getByText(/cache|storage|clear.*data/i)).toBeVisible();
  });

  test('clear thumbnails cache button exists', async ({ galleryPage }) => {
    await expect(galleryPage.getByRole('button', { name: /clear.*thumbnails|thumbnails.*cache/i })).toBeVisible();
  });

  test('clear full media cache button exists', async ({ galleryPage }) => {
    await expect(galleryPage.getByRole('button', { name: /clear.*media|full.*media.*cache/i })).toBeVisible();
  });

  test('cache clearing triggers confirmation', async ({ galleryPage }) => {
    const clearButton = galleryPage.getByRole('button', { name: /clear.*thumbnails|thumbnails.*cache/i }).first();
    await clearButton.click();
    
    // Should show confirmation dialog
    await expect(galleryPage.getByRole('dialog').or(galleryPage.getByText(/are.*you.*sure|confirm/i))).toBeVisible({ timeout: 5000 });
  });

  test('cache statistics are displayed', async ({ galleryPage }) => {
    // Look for cache size/usage information
    await expect(galleryPage.getByText(/cache.*size|storage.*used/i)).toBeVisible();
  });
});