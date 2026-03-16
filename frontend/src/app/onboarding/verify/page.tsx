'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// Redirect /onboarding/verify to /verify-email, preserving query params (token)
function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/verify-email${qs ? `?${qs}` : ''}`);
  }, [router, searchParams]);
  return null;
}

export default function VerifyEmailRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
