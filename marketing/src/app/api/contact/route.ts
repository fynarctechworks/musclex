import { NextResponse } from 'next/server';

/**
 * Contact form ingest.
 *
 * The browser POSTs here; this handler forwards to the SaaS Control Center with
 * a shared secret. That keeps the SCC endpoint off the public internet and out
 * of CORS entirely — the secret lives only in this server process, never in the
 * bundle. Do NOT prefix these env vars with NEXT_PUBLIC_.
 *
 * Requires, on the marketing app:
 *   SCC_API_URL            e.g. https://scc.example.com/api/v1
 *   MARKETING_INGEST_SECRET  (must match the SCC's value)
 */

export const runtime = 'nodejs';
// Never cache a POST handler's response.
export const dynamic = 'force-dynamic';

const BRANCHES = new Set(['1', '2-5', '6-20', '20+']);

/** Mirrors the SCC DTO's bounds so junk is rejected before it leaves here. */
const LIMITS = {
  name: 120,
  studio_name: 160,
  email: 200,
  phone: 32,
  topic: 80,
  message: 4000,
} as const;

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  const sccUrl = process.env.SCC_API_URL?.replace(/\/$/, '');
  const secret = process.env.MARKETING_INGEST_SECRET;

  if (!sccUrl || !secret) {
    // Fail loudly in the server log, vaguely to the visitor — a misconfigured
    // deploy is our problem, not something to explain to a prospect.
    console.error(
      '[contact] SCC_API_URL or MARKETING_INGEST_SECRET is not set; cannot forward lead.',
    );
    return NextResponse.json(
      { error: 'Contact form is not available right now. Please email us directly.' },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: a field hidden from humans. Anything that fills it is a bot, so
  // return the success shape without storing — telling a bot it failed just
  // invites a retry with the field cleared.
  if (str(body.company, 200)) {
    return NextResponse.json({ ok: true });
  }

  const payload = {
    name: str(body.name, LIMITS.name),
    studio_name: str(body.studio, LIMITS.studio_name),
    email: str(body.email, LIMITS.email),
    phone: str(body.phone, LIMITS.phone),
    branches: BRANCHES.has(str(body.branches, 16)) ? str(body.branches, 16) : undefined,
    topic: str(body.topic, LIMITS.topic) || undefined,
    message: str(body.message, LIMITS.message),
    source: 'marketing_contact',
    user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? undefined,
  };

  const missing = (['name', 'studio_name', 'email', 'phone', 'message'] as const).filter(
    (k) => !payload[k],
  );
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${sccUrl}/gym-owner-leads/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-secret': secret,
      },
      body: JSON.stringify(payload),
      // A hung control plane must not hang the visitor's browser.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Log the status, not the body: the body echoes back the prospect's PII.
      console.error(`[contact] SCC ingest failed with ${res.status}`);
      return NextResponse.json(
        { error: 'We could not submit your enquiry. Please email us directly.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[contact] SCC ingest threw:', (error as Error).name);
    return NextResponse.json(
      { error: 'We could not submit your enquiry. Please email us directly.' },
      { status: 502 },
    );
  }
}
