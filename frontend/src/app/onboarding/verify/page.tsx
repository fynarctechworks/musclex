'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect /onboarding/verify to /verify-email
export default function VerifyEmailRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/verify-email');
  }, [router]);
  return null;
}
