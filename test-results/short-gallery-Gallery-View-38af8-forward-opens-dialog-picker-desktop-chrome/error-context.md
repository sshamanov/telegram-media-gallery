# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: short/gallery.spec.ts >> Gallery View @short >> selection mode: forward opens dialog picker
- Location: tests/e2e/short/gallery.spec.ts:244:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost:5173/
Call log:
  - navigating to "https://localhost:5173/", waiting until "load"

```

# Test source

```ts
  1  | import { test as base } from '@playwright/test';
  2  | import type { Page } from '@playwright/test';
  3  | 
  4  | export const test = base.extend<{
  5  |   authPage: Page;
  6  |   galleryPage: Page;
  7  | }>({
  8  |   authPage: async ({ page }, use) => {
  9  |     await page.goto('/');
  10 |     await use(page);
  11 |   },
  12 |   
  13 |   galleryPage: async ({ page }, use) => {
> 14 |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost:5173/
  15 |     
  16 |     // Wait for auth screen to load
  17 |     await page.waitForSelector('[data-testid="auth-screen"]', { timeout: 5000 });
  18 |     
  19 |     // Mock login with any phone number using stable hooks
  20 |     await page.getByRole('tab', { name: /phone/i }).click();
  21 |     await page.getByTestId('phone-input').fill('1234567890');
  22 |     await page.getByTestId('send-code-button').click();
  23 |     
  24 |     // Wait for code step to appear
  25 |     await page.waitForSelector('[data-auth-step="code"]', { timeout: 5000 });
  26 |     
  27 |     // Enter mock code (any code works except '123456' which triggers 2FA)
  28 |     await page.getByTestId('verification-code-input').fill('000000');
  29 |     await page.getByTestId('submit-code-button').click();
  30 |     
  31 |     // Wait for dialogs screen to load using stable hook
  32 |     await page.waitForSelector('[data-testid="dialogs-screen"]', { timeout: 10000 });
  33 |     
  34 |     await use(page);
  35 |   },
  36 | });
  37 | 
  38 | export { expect } from '@playwright/test';
```