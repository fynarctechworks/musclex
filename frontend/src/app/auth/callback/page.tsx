'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthCallbackPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        // Also check for hash fragment (implicit flow)
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');

        let session;

        // First, check if Supabase auto-detected the session from URL on init
        const { data: { session: autoSession } } = await supabase.auth.getSession();
        if (autoSession) {
          session = autoSession;
        } else if (code) {
          // PKCE flow — exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        } else if (hashAccessToken && hashRefreshToken) {
          // Implicit flow — set session from hash tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });
          if (error) throw error;
          session = data.session;
        }

        if (!session) {
          throw new Error('No authentication data found. The link may have expired.');
        }

        const user = session.user;
        const metadata = user.user_metadata || {};

        setAuth({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user: {
            id: user.id,
            email: user.email!,
            full_name: metadata.full_name || '',
            role: metadata.role || 'owner',
            studio_id: metadata.studio_id,
            branch_ids: metadata.branch_ids || [],
            onboarding_step: metadata.onboarding_step || 'select_plan',
          },
          studio: null,
        });

        sessionStorage.removeItem('pendingEmail');
        setStatus('success');

        // Redirect based on onboarding step
        const step = metadata.onboarding_step || 'select_plan';
        setTimeout(() => {
          if (step === 'setup_studio') router.push('/onboarding/setup');
          else if (step === 'complete') {
            // Fetch studio slug for redirect
            const studioId = metadata.studio_id;
            if (studioId) {
              fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/settings/account`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
                .then(r => r.json())
                .then(data => {
                  const slug = data?.studio?.slug;
                  router.push(slug ? `/${slug}/dashboard` : '/onboarding/setup');
                })
                .catch(() => router.push('/onboarding/setup'));
            } else {
              router.push('/onboarding/setup');
            }
          }
          else router.push('/onboarding/plans');
        }, 1500);
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Email verification failed',
        );
      }
    };

    handleAuth();
  }, [router, setAuth]);

  if (status === 'processing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Verifying your email...</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please wait while we confirm your account.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Email verified!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Redirecting to continue setup...
          </p>
          <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Verification failed</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">{errorMessage}</p>
        <div className="space-y-3">
          <Button
            onClick={() => router.push('/onboarding')}
            className="w-full h-10 bg-foreground hover:bg-foreground/90 text-background font-semibold text-[13px]"
          >
            Back to registration
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/login')}
            className="w-full h-10 text-[13px]"
          >
            Go to login
          </Button>
        </div>
      </div>
    </div>
  );
}
