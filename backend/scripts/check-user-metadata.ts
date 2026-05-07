import { createClient } from '@supabase/supabase-js';

const USER_ID = '01b37479-06b4-4844-b138-0fd6a263f067';

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data, error } = await supabase.auth.admin.getUserById(USER_ID);
  if (error || !data?.user) {
    console.error('Failed:', error);
    process.exit(1);
  }
  console.log('\nUser:', data.user.id);
  console.log('Email:', data.user.email);
  console.log('\nuser_metadata:');
  console.log(JSON.stringify(data.user.user_metadata, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
