import { test, expect } from '../shared/fixtures';

test.describe('Upload Flow @long', () => {
  test.beforeEach(async ({ galleryPage }) => {
    // Navigate to gallery view
    const firstDialog = galleryPage.locator('[data-testid="dialog-item"]').first();
    await firstDialog.click();
    await expect(galleryPage.getByTestId('gallery-root')).toBeVisible({ timeout: 10000 });
  });

  test('upload button is visible', async ({ galleryPage }) => {
    await expect(galleryPage.getByTestId('gallery-upload-toggle')).toBeVisible();
  });

  test('upload sheet opens', async ({ galleryPage }) => {
    const uploadButton = galleryPage.getByTestId('gallery-upload-toggle');
    await uploadButton.click();
    
    await expect(galleryPage.getByTestId('gallery-upload-sheet')).toBeVisible({ timeout: 5000 });
  });

  test('upload sheet shows media and file options', async ({ galleryPage }) => {
    const uploadButton = galleryPage.getByTestId('gallery-upload-toggle');
    await uploadButton.click();
    
    await expect(galleryPage.getByText(/upload as media/i)).toBeVisible();
    await expect(galleryPage.getByText(/upload as file/i)).toBeVisible();
  });
});