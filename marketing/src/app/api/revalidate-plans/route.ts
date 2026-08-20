import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * On-demand revalidation for the plan catalogue.
 *
 * The pricing page and home page are ISR with a 5-minute window, so a plan
 * edited in the SCC would otherwise take up to that long to appear. The SCC
 * calls this immediately after a plan mutation, so the change is live at once.
 *
 * Protected by the same shared secret as the other server-to-server routes —
 * otherwise anyone could force cache churn on demand.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.MARKETING_INGEST_SECRET;

  if (!secret) {
    console.error('[revalidate-plans] MARKETING_INGEST_SECRET is not set; refusing.');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (request.headers.get('x-ingest-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Both surfaces render plan data.
  revalidatePath('/pricing');
  revalidatePath('/');

  return NextResponse.json({ revalidated: ['/pricing', '/'], at: Date.now() });
}
