// TEMP — Sentry verification page. Hidden unless NEXT_PUBLIC_ENABLE_SENTRY_DEBUG=true.
// REMOVE after launch verification (see 16-monitoring-setup-prompt.txt Step 3).
'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_SENTRY_DEBUG !== 'true') {
    notFound();
  }

  const [sent, setSent] = useState(false);

  const triggerCaptured = () => {
    Sentry.captureException(new Error('Sentry frontend test — captured exception (safe to ignore)'));
    setSent(true);
  };

  const triggerUnhandled = () => {
    // This will be caught by app/error.tsx (or global-error.tsx) and forwarded to Sentry.
    throw new Error('Sentry frontend test — unhandled exception (safe to ignore)');
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '36rem', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Sentry verification</h1>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        This page exists only to verify the Sentry pipeline. Remove the route
        once verified in the dashboard.
      </p>
      <p style={{ marginTop: '1rem' }}>
        DSN configured:{' '}
        <strong>{process.env.NEXT_PUBLIC_SENTRY_DSN ? 'yes' : 'no (will no-op)'}</strong>
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
        <button
          onClick={triggerCaptured}
          style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #ccc', cursor: 'pointer' }}
        >
          Send captured error
        </button>
        <button
          onClick={triggerUnhandled}
          style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #ccc', cursor: 'pointer', background: '#fee2e2' }}
        >
          Throw unhandled error
        </button>
      </div>
      {sent && (
        <p style={{ marginTop: '1rem', color: '#16a34a' }}>
          Captured error sent. Check Sentry → Issues.
        </p>
      )}
    </main>
  );
}
