'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect /onboarding to /register
export default function OnboardingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/register');
  }, [router]);
  return null;
}
