'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            textAlign: 'center',
            background: '#0D1B2A',
            color: '#FFFFFF',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: '1.5rem', color: '#B0C8E0', maxWidth: '24rem' }}>
            A critical error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p style={{ marginBottom: '1.5rem', fontFamily: 'monospace', color: '#5A7A9A' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              background: '#4A9FD4',
              color: '#FFFFFF',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
