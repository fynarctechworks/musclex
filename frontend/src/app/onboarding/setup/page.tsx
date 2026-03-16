'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy redirect — setup page moved to /onboarding/studio-info */
export default function SetupStudioRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding/studio-info');
  }, [router]);
  return null;
}
