import { test, expect } from '@playwright/test';
import { BACKEND_URL, E2E_OWNER, E2E_OWNER_B } from '../playwright.config';
import { sharedToken } from './helpers';

/**
 * Genuine two-owner cross-tenant isolation. Owner A and Owner B are real,
 * separate studios. Neither may reach the other's studio-scoped resources.
 * Tokens come from global-setup (Supabase-direct).
 */
const authA = () => ({ Authorization: `Bearer ${sharedToken('A')}` });
const authB = () => ({ Authorization: `Bearer ${sharedToken('B')}` });

test.describe('cross-tenant isolation (two real owners)', () => {
  test('owner B cannot read owner A\'s wallet, and vice-versa', async ({ request }) => {
    // B → A's wallet = 403
    const bToA = await request.get(`${BACKEND_URL}/api/v1/admin/referrals/wallets/${E2E_OWNER.studioId}`, { headers: authB() });
    expect(bToA.status(), 'owner B must NOT read studio A wallet').toBe(403);

    // A → B's wallet = 403
    const aToB = await request.get(`${BACKEND_URL}/api/v1/admin/referrals/wallets/${E2E_OWNER_B.studioId}`, { headers: authA() });
    expect(aToB.status(), 'owner A must NOT read studio B wallet').toBe(403);

    // B CAN reach their own wallet (not 403).
    const bOwn = await request.get(`${BACKEND_URL}/api/v1/admin/referrals/wallets/${E2E_OWNER_B.studioId}`, { headers: authB() });
    expect(bOwn.status(), 'owner B should reach own wallet').not.toBe(403);
  });

  test('neither owner can manual-adjust any wallet (owner is not platform admin)', async ({ request }) => {
    const resp = await request.post(`${BACKEND_URL}/api/v1/admin/referrals/wallets/manual-adjustment`, {
      headers: authB(),
      data: { studio_id: E2E_OWNER_B.studioId, amount: 50, reason: 'e2e isolation test' },
    });
    expect(resp.status()).toBe(403);
  });
});
