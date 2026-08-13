import { Page, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { BACKEND_URL } from '../playwright.config';
import * as fs from 'fs';
import * as path from 'path';

/** Read a shared token minted in global-setup (Supabase-direct, backend-valid). */
export function sharedToken(who: 'A' | 'B'): string {
  const p = path.join(__dirname, '.auth', 'tokens.json');
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  return t[who].token as string;
}

/** Log in through the real UI as the given owner; resolves once off /login.
 *  Next dev hydrates lazily on cold compile — before the client onSubmit attaches,
 *  the form falls back to a native GET (never authenticates). So we retry fill+click
 *  until the real POST /auth/login fires and the app redirects away. */
export async function loginAsOwner(
  page: Page,
  owner: { email: string; password: string },
): Promise<void> {
  // Locate by name/autocomplete (stable) — NOT by type, which the show/hide toggle flips.
  const email = page.locator('input[name="email"], input[autocomplete="email"]').first();
  const pass = page.locator('input[name="password"], input[autocomplete="current-password"]').first();
  const submit = page.locator('button[type="submit"]').first();
  const toggle = page.locator('button[aria-label*="password" i]').first(); // Show/Hide (type=button)

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await pass.waitFor({ state: 'visible' });

  // Hydration gate: the show-password toggle is a client onClick and cannot submit
  // the form. When clicking it flips the input type to "text", React has hydrated and
  // handleSubmit will preventDefault — so the next real submit won't native-GET.
  const deadline = Date.now() + 60_000;
  let hydrated = false;
  while (Date.now() < deadline) {
    await toggle.click().catch(() => {});
    if ((await pass.getAttribute('type')) === 'text') { hydrated = true; break; }
    await page.waitForTimeout(1000);
  }
  if (!hydrated) throw new Error('login page never hydrated');
  await toggle.click().catch(() => {}); // back to password type (cosmetic)

  await email.fill(owner.email);
  await pass.fill(owner.password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login') && r.request().method() === 'POST', { timeout: 25_000 }),
    submit.click(),
  ]);
  await expect(page, 'login should leave /login').not.toHaveURL(/\/login(\?|$)/, { timeout: 30_000 });
}

/** Get a backend JWT for an owner (for API-level assertions).
 *  Retries with backoff so a transient Supabase Auth rate-limit (which surfaces as
 *  a 401 invalid_credentials under heavy login volume) doesn't fail the suite. */
export async function apiTokenFor(owner: { email: string; password: string }): Promise<{ token: string; ctx: APIRequestContext }> {
  const ctx = await pwRequest.newContext();
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await ctx.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: { email: owner.email, password: owner.password },
    });
    if (resp.ok()) {
      const body = await resp.json();
      return { token: body.access_token || body.accessToken, ctx };
    }
    last = `${resp.status()} ${await resp.text()}`;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  expect(false, `login failed after retries: ${last}`).toBeTruthy();
  throw new Error('unreachable');
}
