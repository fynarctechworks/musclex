import { test, expect } from '@playwright/test';
import { E2E_OWNER } from '../playwright.config';
import { loginAsOwner } from './helpers';

/**
 * Authenticated browser flow using the seeded E2E owner. Drives the real login
 * UI in Chromium and confirms it lands in the authenticated app shell.
 */
test('owner can log in through the UI and reach the app shell', async ({ page }) => {
  await loginAsOwner(page, E2E_OWNER);
  await expect(page).not.toHaveURL(/\/login/);
});
