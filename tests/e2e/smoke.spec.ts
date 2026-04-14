import { test, expect } from '@playwright/test';

test('basic app smoke test', async ({ page }) => {
  // Navigate to app with HTTPS ignore
  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });
  
  // Check page title
  await expect(page).toHaveTitle(/Telegram Gallery/i);
  
  // Check for auth screen
  await expect(page.getByRole('heading', { name: /Telegram Gallery/i })).toBeVisible();
  
  // Check for phone tab
  await expect(page.getByRole('tab', { name: /phone/i })).toBeVisible();
  
  // Switch to phone tab and check input
  await page.getByRole('tab', { name: /phone/i }).click();
  await expect(page.getByPlaceholder('Phone number')).toBeVisible();
  
  // Enter phone and login
  await page.getByPlaceholder('Phone number').fill('1234567890');
  await page.getByRole('button', { name: /next|continue|sign in/i }).click();
  
  // Check for dialog list
  await expect(page.getByRole('heading', { name: /dialogs|conversations/i })).toBeVisible({ timeout: 10000 });
  
  // Check for tabs
  await expect(page.getByRole('tab', { name: /galleries/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /groups/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /chats/i })).toBeVisible();
});