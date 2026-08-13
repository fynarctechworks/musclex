/**
 * Create a dedicated E2E test owner (idempotent). Namespaced so it never collides
 * with real accounts. Safe to re-run (resets password). TEST DB ONLY.
 *
 *   npx ts-node scripts/create-e2e-user.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'E2eOwner@12345';

// Studio A = the real "Mama" studio. Studio B = a dedicated E2E-only studio so we
// can prove cross-tenant isolation with TWO genuine owners.
const STUDIO_A = '00ca8c7f-9df3-4791-95a7-8002c604cead';
const STUDIO_B = 'e2e00000-0000-4000-8000-0000000000b2';

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function ensureOwner(email: string, studioId: string, name: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users?.find((u) => u.email === email);
  const meta = { role: 'owner', studio_id: studioId, full_name: name, onboarding_step: 'complete' };
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true, user_metadata: meta });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    user = data.user!;
  }
  // JwtAuthGuard requires a matching public.user_identities row or it 401s.
  const { error: idErr } = await admin.from('user_identities').upsert({ id: user!.id, email, full_name: name }, { onConflict: 'id' });
  if (idErr) console.warn(`user_identities warn (${email}):`, idErr.message);
  return user!.id;
}

async function main() {
  const ownerA = await ensureOwner('e2e-owner@musclex.test', STUDIO_A, 'E2E Owner A');

  const ownerB = await ensureOwner('e2e-owner-b@musclex.test', STUDIO_B, 'E2E Owner B');
  // Studio B row (shared studio_template schema → gym_id-filtered, sees no other gym's rows).
  const { error: sErr } = await admin.from('studios').upsert({
    id: STUDIO_B, name: 'E2E Studio B', slug: 'e2e-studio-b',
    schema_name: 'studio_template', owner_user_id: ownerB, referral_code: 'E2EB0001',
  }, { onConflict: 'id' });
  if (sErr) console.warn('studio B upsert warn:', sErr.message);

  console.log(JSON.stringify({
    ownerA: { email: 'e2e-owner@musclex.test', studio_id: STUDIO_A, id: ownerA },
    ownerB: { email: 'e2e-owner-b@musclex.test', studio_id: STUDIO_B, id: ownerB },
    password: PASSWORD,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
