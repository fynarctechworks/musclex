import { redirect } from 'next/navigation';

/**
 * The gym admin app has no public marketing surface of its own.
 *
 * Selling MuscleX is the job of the standalone marketing site (`marketing/`),
 * so `/` here is not a landing page — it goes straight to sign-in. The old
 * landing components still live in `app/landing/` but are no longer reachable:
 * that directory has no `page.tsx`, and this was its only entry point.
 *
 * `/` stays allowlisted in `middleware.ts` so this redirect runs for signed-out
 * visitors instead of the gate bouncing them first (same destination either
 * way, but this keeps the reason explicit).
 */
export default function Home() {
  redirect('/login');
}
