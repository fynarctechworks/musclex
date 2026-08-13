import { test, expect } from '@playwright/test';
import { FRONTEND_URL } from '../playwright.config';

/**
 * No-auth browser tests. These validate the audit #20 CSP fix and the
 * middleware behaviour directly in a real Chromium.
 */
test.describe('security headers & unauth routing', () => {
  test('login page renders', async ({ page }) => {
    const resp = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), 'login page should return 2xx').toBeLessThan(400);
    // A password field is the reliable signal the login UI mounted.
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('security headers present on a page response (audit #20)', async ({ request }) => {
    const resp = await request.get(`${FRONTEND_URL}/login`);
    const h = resp.headers();
    expect(h['content-security-policy'], 'CSP header must be set').toBeTruthy();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("object-src 'none'");
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBeTruthy();
    expect(h['permissions-policy']).toBeTruthy();
  });

  test('unauthenticated gym route redirects to /login', async ({ page }) => {
    await page.goto('/mama/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });
});
