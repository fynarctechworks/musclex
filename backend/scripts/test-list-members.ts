import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const BACKEND = 'http://localhost:4000';

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, key);

  const { data, error } = await supa.auth.admin.generateLink({
    type: 'magiclink',
    email: 'gandiphanendra@gmail.com',
  });
  if (error) throw error;
  const hashed = (data as any).properties?.hashed_token;
  const anon = createClient(url, process.env.SUPABASE_ANON_KEY!);
  const { data: s } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: hashed } as any);
  const token = s.session?.access_token!;

  // List branches
  const br = await fetch(`${BACKEND}/api/v1/branches`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('GET /branches:', br.status, (await br.text()).slice(0, 400));

  // List members
  const m = await fetch(`${BACKEND}/api/v1/members`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('GET /members:', m.status, (await m.text()).slice(0, 400));

  // List plans
  const p = await fetch(`${BACKEND}/api/v1/members/plans`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('GET /members/plans:', p.status, (await p.text()).slice(0, 400));
}
main().catch((e) => { console.error(e); process.exit(1); });
