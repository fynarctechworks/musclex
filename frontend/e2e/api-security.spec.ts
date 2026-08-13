import { test, expect } from '@playwright/test';
import { BACKEND_URL, E2E_OWNER } from '../playwright.config';
import { sharedToken } from './helpers';

/**
 * API-level regression tests that pin the 2026-07-11 audit fixes against the
 * running backend (:4000). If any of these ever go green→red, a security fix
 * has regressed. Uses a shared Supabase-direct token from global-setup.
 */
const auth = () => ({ Authorization: `Bearer ${sharedToken('A')}` });

test('unauthenticated protected route → 401', async ({ request }) => {
  const resp = await request.get(`${BACKEND_URL}/api/v1/admin/referrals/campaigns`);
  expect(resp.status()).toBe(401);
});

test('#1 wallet manual-adjustment is forbidden for a gym owner → 403', async ({ request }) => {
  const resp = await request.post(`${BACKEND_URL}/api/v1/admin/referrals/wallets/manual-adjustment`, {
    headers: auth(),
    data: { studio_id: E2E_OWNER.studioId, amount: 100, reason: 'e2e regression test' },
  });
  expect(resp.status(), 'owner must NOT be able to adjust wallets').toBe(403);
});

test('#1 amount bounds enforced by DTO → 400', async ({ request }) => {
  const resp = await request.post(`${BACKEND_URL}/api/v1/admin/referrals/wallets/manual-adjustment`, {
    headers: auth(),
    data: { studio_id: E2E_OWNER.studioId, amount: 999_999_999, reason: 'e2e out of range' },
  });
  // ValidationPipe (400) fires before the handler's role check.
  expect(resp.status()).toBe(400);
});

test('#3 cross-tenant wallet read is forbidden → 403', async ({ request }) => {
  const otherStudio = '11111111-1111-1111-1111-111111111111';
  const resp = await request.get(`${BACKEND_URL}/api/v1/admin/referrals/wallets/${otherStudio}`, {
    headers: auth(),
  });
  expect(resp.status(), 'owner must NOT read another studio wallet').toBe(403);
});

test('#3 own-studio wallet read is NOT forbidden (fix does not over-block)', async ({ request }) => {
  const resp = await request.get(`${BACKEND_URL}/api/v1/admin/referrals/wallets/${E2E_OWNER.studioId}`, {
    headers: auth(),
  });
  expect(resp.status(), 'owner should reach their own wallet').not.toBe(403);
});

test('#10 upload rejects a non-image with a spoofed image MIME → 400', async ({ request }) => {
  const resp = await request.post(`${BACKEND_URL}/api/v1/uploads/photo`, {
    headers: auth(),
    multipart: {
      file: { name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('<html>not an image</html>') },
    },
  });
  expect(resp.status(), 'spoofed content must be rejected').toBe(400);
});
