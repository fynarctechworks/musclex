'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, XCircle } from 'lucide-react';
import { Spinner } from '@/components/shared';
import { Button } from '@/components/ui/button';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { loginWithOAuth } = useAuth();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const url = new URL(window.location.href);

        // Provider returned an explicit error (user denied, etc.)
        const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');
        if (oauthError) throw new Error(decodeURIComponent(oauthError));

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

        if (!session?.access_token || !session?.refresh_token) {
          throw new Error('No authentication data found. The link may have expired.');
        }

        // Hand the verified Supabase session to the backend, which syncs the
        // local identity + RBAC and returns the normalized auth payload. The
        // hook then routes exactly like password login: fresh social users land
        // in the onboarding wizard, returning users go straight to their
        // dashboard, multi-workspace users hit the selector.
        await loginWithOAuth(session.access_token, session.refresh_token);
        // loginWithOAuth performs the redirect on success — nothing more to do.
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Sign-in failed',
        );
      }
    };

    handleAuth();
    // loginWithOAuth is stable (useCallback); run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'processing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="flex justify-center mb-4"><Spinner size="lg" label="Signing you in" /></div>
          <h1 className="text-xl font-semibold text-foreground">Signing you in...</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please wait while we set up your session.
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
        <h1 className="text-xl font-semibold text-foreground">Sign-in failed</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">{errorMessage}</p>
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => router.push('/login')}
            className="w-full h-10 text-[13px]"
          >
            Back to sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
