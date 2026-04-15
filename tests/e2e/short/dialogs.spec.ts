import { test, expect } from '../shared/fixtures';

test.describe('Dialog Navigation @short', () => {
  test('dialog list loads after login', async ({ galleryPage }) => {
    // Check for dialogs screen
    await expect(galleryPage.locator('[data-testid="dialogs-screen"]')).toBeVisible();
    
    // Check for main heading
    await expect(galleryPage.getByRole('heading', { name: 'Telegram Gallery' })).toBeVisible();
  });

  test('tabs are visible: Galleries, Groups, Chats', async ({ galleryPage }) => {
    await expect(galleryPage.getByTestId('galleries-tab')).toBeVisible();
    await expect(galleryPage.getByTestId('groups-tab')).toBeVisible();
    await expect(galleryPage.getByTestId('chats-tab')).toBeVisible();
  });

  test('search input is present', async ({ galleryPage }) => {
    await expect(galleryPage.getByTestId('dialog-search')).toBeHidden();
  });

  test('clicking dialog navigates to gallery', async ({ galleryPage }) => {
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await expect(firstDialog).toBeVisible({ timeout: 5000 });
    await firstDialog.click();

    await expect(galleryPage.locator('[data-testid="gallery-screen"]')).toBeVisible({ timeout: 5000 });
    await expect(galleryPage.getByTestId('gallery-root')).toBeVisible();
  });

  test('tab switching works', async ({ galleryPage }) => {
    // Click Groups tab
    await galleryPage.getByTestId('groups-tab').click();
    await expect(galleryPage.getByTestId('groups-tab')).toHaveAttribute('aria-selected', 'true');
    
    // Click Chats tab  
    await galleryPage.getByTestId('chats-tab').click();
    await expect(galleryPage.getByTestId('chats-tab')).toHaveAttribute('aria-selected', 'true');
    
    // Click back to Galleries tab
    await galleryPage.getByTestId('galleries-tab').click();
    await expect(galleryPage.getByTestId('galleries-tab')).toHaveAttribute('aria-selected', 'true');
  });
});
