import * as fs from 'fs';
import * as path from 'path';
import { E2E_OWNER, E2E_OWNER_B } from '../playwright.config';

/**
 * One-time E2E setup: obtain access tokens for both owners by authenticating with
 * Supabase DIRECTLY (anon key). We deliberately bypass the backend's /auth/login,
 * whose supabase client uses the service_role key for signInWithPassword and gets
 * rate-limited/flaky under load — see AUDIT notes. Tokens are validated by the
 * backend's JwtAuthGuard (network getUser), so they work for all authz tests.
 * Writes e2e/.auth/tokens.json (git-ignored).
 */
function readEnv(): { url: string; anon: string } {
  // Prefer real env, else parse frontend/.env.local.
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anon) {
    const envPath = path.join(__dirname, '..', '.env.local');
    const txt = fs.readFileSync(envPath, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)\s*=\s*(.+)\s*$/);
      if (m) {
        const v = m[2].replace(/^["']|["']$/g, '').trim();
        if (m[1].endsWith('URL')) url = v;
        else anon = v;
      }
    }
  }
  if (!url || !anon) throw new Error('Missing Supabase URL/anon key for E2E setup');
  return { url, anon };
}

async function tokenFor(url: string, anon: string, email: string, password: string): Promise<string> {
  const resp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) throw new Error(`Supabase auth failed for ${email}: ${resp.status} ${await resp.text()}`);
  const body = await resp.json();
  if (!body.access_token) throw new Error(`No access_token for ${email}`);
  return body.access_token as string;
}

export default async function globalSetup() {
  const { url, anon } = readEnv();
  const tokens = {
    A: { token: await tokenFor(url, anon, E2E_OWNER.email, E2E_OWNER.password), studio_id: E2E_OWNER.studioId, email: E2E_OWNER.email },
    B: { token: await tokenFor(url, anon, E2E_OWNER_B.email, E2E_OWNER_B.password), studio_id: E2E_OWNER_B.studioId, email: E2E_OWNER_B.email },
  };
  const dir = path.join(__dirname, '.auth');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens, null, 2));
}
