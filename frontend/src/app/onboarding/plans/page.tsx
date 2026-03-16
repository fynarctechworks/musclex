'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy redirect — plans page moved to /onboarding/subscription */
export default function PlansRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding/subscription');
  }, [router]);
  return null;
}
