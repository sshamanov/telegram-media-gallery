import { test, expect } from '../shared/fixtures';

test.describe('Cache Management @long', () => {
  test.beforeEach(async ({ galleryPage }) => {
    // Open settings
    const settingsButton = galleryPage.getByRole('button', { name: /settings|gear|cog/i });
    await settingsButton.click();
    await expect(galleryPage.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 5000 });
  });

  test('cache management section is visible', async ({ galleryPage }) => {
    await expect(galleryPage.getByRole('heading', { name: /settings/i })).toBeVisible();
    await expect(galleryPage.locator('fieldset').filter({ hasText: 'Storage' })).toBeVisible();
  });

  test('clear thumbnails cache button exists', async ({ galleryPage }) => {
    // The button just says "Clear" next to "Thumbnails (IndexedDB)"
    await expect(galleryPage.getByText('Thumbnails (IndexedDB)')).toBeVisible();
    await expect(galleryPage.getByRole('button', { name: 'Clear' }).first()).toBeVisible();
  });

  test('clear full media cache button exists', async ({ galleryPage }) => {
    // There are multiple "Clear" buttons, we need to check they exist in the storage section
    await expect(galleryPage.getByText('Full media (OPFS)')).toBeVisible();
    const clearButtons = galleryPage.getByRole('button', { name: 'Clear' });
    await expect(clearButtons).toHaveCount(3); // Thumbnails, Full media, App cache
  });

  test('cache statistics are displayed', async ({ galleryPage }) => {
    // Look for cache size/usage information in storage section
    await expect(galleryPage.getByText('0 items · 0 B').first()).toBeVisible();
  });
});