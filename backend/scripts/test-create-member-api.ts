/**
 * Generates a Supabase access token for an existing user and calls the
 * /api/v1/members endpoint with a minimal payload, so we can see the real
 * error the 500 is hiding.
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const BACKEND = 'http://localhost:4000';
const TARGET_EMAIL = process.argv[2] || 'gandiphanendra@gmail.com';

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, key);

  // Generate a magic link token pair for the user
  const { data, error } = await supa.auth.admin.generateLink({
    type: 'magiclink',
    email: TARGET_EMAIL,
  });
  if (error) throw error;

  // Exchange the token_hash for a session via verify
  const hashed = (data as any).properties?.hashed_token;
  if (!hashed) throw new Error('No hashed_token from admin.generateLink');

  const anonKey = process.env.SUPABASE_ANON_KEY!;
  const anonClient = createClient(url, anonKey);
  const { data: sessionData, error: sessionErr } = await anonClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashed,
  } as any);
  if (sessionErr) throw sessionErr;

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('No access_token');
  console.log('Got access_token');

  // Now try creating a member
  const userMeta = sessionData.user?.user_metadata || {};
  console.log('user_metadata:', JSON.stringify(userMeta, null, 2));

  const payload = {
    full_name: 'API Test Member',
    phone: `+9199${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
    branch_id: process.argv[3] || '3a109352-ced9-4241-906c-2450c7393bd8',
    status: 'active',
  };
  console.log('\nPOST /api/v1/members payload:', payload);

  const res = await fetch(`${BACKEND}/api/v1/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log(`\nStatus: ${res.status}`);
  console.log('Body:', text);
}
main().catch((e) => { console.error(e); process.exit(1); });
