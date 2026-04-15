import { test, expect } from '@playwright/test';

test.describe('Mobile Responsiveness @long', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('app loads on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Telegram Gallery/i);
  });

  test('auth screen adapts to mobile', async ({ page }) => {
    await page.goto('/');
    
    // Check for mobile-friendly layout
    await expect(page.getByRole('heading', { name: /Telegram Gallery/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /phone/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /qr/i })).toBeVisible();
    
    // Tabs should be touch-friendly
    const phoneTab = page.getByRole('tab', { name: /phone/i });
    const tabSize = await phoneTab.boundingBox();
    expect(tabSize?.width).toBeGreaterThanOrEqual(44); // Minimum touch target
    expect(tabSize?.height).toBeGreaterThanOrEqual(44);
  });

  test('mobile navigation works', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByRole('tab', { name: /phone/i }).click();
    await page.getByTestId('phone-input').fill('1234567890');
    await page.getByTestId('send-code-button').click();
    
    // Wait for code step
    await page.waitForSelector('[data-auth-step="code"]', { timeout: 5000 });
    
    // Enter mock code
    await page.getByTestId('verification-code-input').fill('000000');
    await page.getByTestId('submit-code-button').click();
    
    // Wait for dialogs
    await expect(page.getByTestId('dialogs-screen')).toBeVisible({ timeout: 10000 });
    
    // Check mobile navigation elements - back button should be visible when in gallery
    const firstDialog = page.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();
    
    await expect(page.getByTestId('gallery-root')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('gallery-back-button')).toBeVisible();
  });

  test('touch interactions work', async ({ page }) => {
    // Login and navigate to gallery
    await page.goto('/');
    await page.getByRole('tab', { name: /phone/i }).click();
    await page.getByTestId('phone-input').fill('1234567890');
    await page.getByTestId('send-code-button').click();
    
    // Wait for code step
    await page.waitForSelector('[data-auth-step="code"]', { timeout: 5000 });
    
    // Enter mock code
    await page.getByTestId('verification-code-input').fill('000000');
    await page.getByTestId('submit-code-button').click();
    
    // Wait for dialogs
    await expect(page.getByTestId('dialogs-screen')).toBeVisible({ timeout: 10000 });
    
    // Tap on dialog
    const firstDialog = page.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();
    
    await expect(page.getByTestId('gallery-root')).toBeVisible({ timeout: 10000 });
    
    // Tap on media item
    const firstMediaItem = page.locator('[data-testid="media-item"]').first();
    await firstMediaItem.click();
    
    // Viewer should open
    await expect(page.locator('.pswp').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5000 });
  });
});