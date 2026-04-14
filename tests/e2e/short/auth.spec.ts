import { test, expect } from '../shared/fixtures';

test.describe('Authentication @short', () => {
  test('app launches and shows auth screen', async ({ authPage }) => {
    await expect(authPage).toHaveTitle(/Telegram Gallery/i);
    await expect(authPage.getByTestId('auth-screen')).toBeVisible();
  });

  test('phone auth tab is available', async ({ authPage }) => {
    await expect(authPage.getByRole('tab', { name: /phone/i })).toBeVisible();
    await expect(authPage.getByRole('tab', { name: /qr/i })).toBeVisible();
  });

  test('phone input field exists', async ({ authPage }) => {
    await authPage.getByRole('tab', { name: /phone/i }).click();
    await expect(authPage.getByTestId('phone-input')).toBeVisible();
    await expect(authPage.getByTestId('send-code-button')).toBeVisible();
  });

  test('QR tab shows QR code area', async ({ authPage }) => {
    await authPage.getByRole('tab', { name: /qr/i }).click();
    await expect(authPage.getByText(/scan.*qr.*code/i)).toBeVisible();
    await expect(authPage.getByTestId('qr-canvas')).toBeVisible();
  });

  test('mock login works with any phone number', async ({ authPage }) => {
    await authPage.getByRole('tab', { name: /phone/i }).click();
    await authPage.getByTestId('phone-input').fill('1234567890');
    await authPage.getByTestId('send-code-button').click();
    
    // Wait for code step
    await expect(authPage.locator('[data-auth-step="code"]')).toBeVisible({ timeout: 5000 });
    
    // Enter mock code
    await authPage.getByTestId('verification-code-input').fill('000000');
    await authPage.getByTestId('submit-code-button').click();
    
    // Should navigate to dialogs screen
    await expect(authPage.getByTestId('dialogs-screen')).toBeVisible({ timeout: 10000 });
  });
});