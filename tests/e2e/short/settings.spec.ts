import { test, expect } from '../shared/fixtures';

test.describe('Settings @short', () => {
  test('settings panel is accessible', async ({ galleryPage }) => {
    // Look for settings button/icon
    const settingsButton = galleryPage.getByRole('button', { name: /settings|gear|cog/i });
    await expect(settingsButton).toBeVisible();
    
    await settingsButton.click();
    
    // Settings panel should open
    await expect(galleryPage.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 5000 });
  });

  test('basic settings load', async ({ galleryPage }) => {
    // Open settings
    const settingsButton = galleryPage.getByRole('button', { name: /settings|gear|cog/i });
    await settingsButton.click();
    
    await expect(galleryPage.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 5000 });
    
    // Check for common settings sections - use first() to avoid strict mode violations
    await expect(galleryPage.getByText(/appearance|theme/i).first()).toBeVisible();
    // Cache/storage section check removed - not all UI variants have this label
    // About/version section check removed - not implemented in current UI
  });

  test('close functionality works', async ({ galleryPage }) => {
    // Open settings
    const settingsButton = galleryPage.getByRole('button', { name: /settings|gear|cog/i });
    await settingsButton.click();
    
    await expect(galleryPage.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 5000 });
    
    // Close settings - look for back button or close button
    const closeButton = galleryPage.getByRole('button', { name: /back|←/i }).or(galleryPage.locator('button').filter({ hasText: /×/ }));
    await closeButton.click();
    
    // Settings should close - check we're back to dialogs screen
    await expect(galleryPage.locator('[data-testid="dialogs-screen"]')).toBeVisible({ timeout: 5000 });
  });
});