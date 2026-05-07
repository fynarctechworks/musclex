import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, key);
  const { data, error } = await supa.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const users = data.users as any[];
  console.log(`Total users: ${users.length}`);
  for (const u of users) {
    const m = u.user_metadata || {};
    console.log(`- ${u.email} | id=${u.id} | studio_id=${m.studio_id} | schema=studio_${(u.id as string).replace(/-/g, '_')} | step=${m.onboarding_step}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
