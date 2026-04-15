import { test, expect } from './shared/fixtures';

test('basic app smoke test', async ({ galleryPage }) => {
  // Check page title
  await expect(galleryPage).toHaveTitle(/Telegram Gallery/i);
  
  // Check for dialog list
  await expect(galleryPage.getByTestId('dialog-list')).toBeVisible({ timeout: 10000 });
  
  // Check for tabs
  await expect(galleryPage.getByTestId('galleries-tab')).toBeVisible();
  await expect(galleryPage.getByTestId('groups-tab')).toBeVisible();
  await expect(galleryPage.getByTestId('chats-tab')).toBeVisible();
});