import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

export const test = base.extend<{
  authPage: Page;
  galleryPage: Page;
}>({
  authPage: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
  
  galleryPage: async ({ page }, use) => {
    await page.goto('/');
    
    // Wait for auth screen to load
    await page.waitForSelector('[data-testid="auth-screen"]', { timeout: 5000 });
    
    // Mock login with any phone number using stable hooks
    await page.getByRole('tab', { name: /phone/i }).click();
    await page.getByTestId('phone-input').fill('1234567890');
    await page.getByTestId('send-code-button').click();
    
    // Wait for code step to appear
    await page.waitForSelector('[data-auth-step="code"]', { timeout: 5000 });
    
    // Enter mock code (any code works except '123456' which triggers 2FA)
    await page.getByTestId('verification-code-input').fill('000000');
    await page.getByTestId('submit-code-button').click();
    
    // Wait for dialogs screen to load using stable hook
    await page.waitForSelector('[data-testid="dialogs-screen"]', { timeout: 10000 });
    
    await use(page);
  },
});

export { expect } from '@playwright/test';