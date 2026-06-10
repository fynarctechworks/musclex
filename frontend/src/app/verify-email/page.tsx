'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Spinner } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { authApi } from '@/features/auth';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const setAuth = useAuthStore((s) => s.setAuth);

  const [status, setStatus] = useState<'waiting' | 'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'waiting'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [email, setEmail] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState('');

  useEffect(() => {
    setEmail(sessionStorage.getItem('pendingEmail') || '');
    setDevVerifyUrl(sessionStorage.getItem('devVerificationUrl') || '');
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto verify when token is present
  useEffect(() => {
    if (!token) return;
    setStatus('verifying');
    let cancelled = false;

    async function verify() {
      try {
        console.log('[verify-email] calling backend with token:', token?.slice(0, 8) + '...');
        const data = await authApi.verifyEmail(token!);
        if (cancelled) return;

        setAuth({
          user: data.user,
          studio: data.studio,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        sessionStorage.removeItem('pendingEmail');
        setStatus('success');
        toast.success('Email verified!');

        // Redirect based on onboarding step
        const step = data.user.onboarding_step;
        const stepRoutes: Record<string, string> = {
          studio_info: '/onboarding/studio-info',
          setup_branches: '/onboarding/branches',
          setup_plans: '/onboarding/memberships',
          setup_staff: '/onboarding/staff',
          select_subscription: '/onboarding/subscription',
          select_plan: '/onboarding/subscription',
          setup_studio: '/onboarding/studio-info',
        };
        setTimeout(() => {
          if (step === 'complete' && data.studio?.slug) {
            router.push(`/${data.studio.slug}/dashboard`);
          } else if (step && stepRoutes[step]) {
            router.push(stepRoutes[step]);
          } else {
            router.push('/onboarding/studio-info');
          }
        }, 1500);
      } catch (err) {
        if (cancelled) return;
        console.error('[verify-email] verification failed:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Verification failed. The link may have expired.');
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token, setAuth, router]);

  const handleResend = useCallback(async () => {
    const pendingEmail = sessionStorage.getItem('pendingEmail') || email;
    if (!pendingEmail) {
      toast.error('Email not found. Please register again.');
      router.push('/register');
      return;
    }

    setResending(true);
    try {
      const res = await authApi.resendVerification(pendingEmail);
      toast.success('Verification email sent! Check your inbox.');
      setCooldown(60);
      if (res.verification_url) {
        sessionStorage.setItem('devVerificationUrl', res.verification_url);
        setDevVerifyUrl(res.verification_url);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resend email';
      if (msg.includes('No pending registration')) {
        toast.error('No pending registration found. Please register again.');
        router.push('/register');
        return;
      }
      toast.error(msg);
    } finally {
      setResending(false);
    }
  }, [email, router]);

  // Dev/testing shortcut: the stored verification URL may carry a stale host/port
  // (e.g. an old FRONTEND_URL). Pull just the token out and re-verify against the
  // CURRENT origin so the click can never die on a refused connection. The real
  // /auth/verify-email endpoint runs either way — this is not an auth bypass.
  const handleDevVerify = useCallback(() => {
    let verifyToken = '';
    try {
      verifyToken = new URL(devVerifyUrl).searchParams.get('token') || '';
    } catch {
      verifyToken = devVerifyUrl.match(/token=([^&]+)/)?.[1] ?? '';
    }
    if (!verifyToken) {
      toast.error('No verification token available. Please resend the email.');
      return;
    }
    // Same-route push: the auto-verify effect re-fires on the new ?token=.
    router.push(`/verify-email?token=${verifyToken}`);
  }, [devVerifyUrl, router]);

  // Token verification in progress
  if (status === 'verifying') {
    return (
      <OnboardingLayout currentStep={1}>
        <div className="text-center space-y-5">
          <div className="flex justify-center"><Spinner size="xl" label="Verifying email" /></div>
          <h1 className="text-[22px] font-semibold text-foreground">Verifying your email...</h1>
          <p className="text-[13px] text-muted-foreground">Please wait while we confirm your account.</p>
        </div>
      </OnboardingLayout>
    );
  }

  // Verification success
  if (status === 'success') {
    return (
      <OnboardingLayout currentStep={1}>
        <div className="text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-[22px] font-semibold text-foreground">Email verified!</h1>
          <p className="text-[13px] text-muted-foreground">Redirecting you to continue setup...</p>
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        </div>
      </OnboardingLayout>
    );
  }

  // Verification error
  if (status === 'error') {
    return (
      <OnboardingLayout currentStep={1}>
        <div className="text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-[22px] font-semibold text-foreground">Verification failed</h1>
          <p className="text-[13px] text-muted-foreground">{errorMessage}</p>
          <div className="space-y-3 pt-2">
            <Button onClick={handleResend} disabled={resending || cooldown > 0} className="w-full">
              {resending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
              ) : cooldown > 0 ? (
                `Resend available in ${cooldown}s`
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Resend verification email</>
              )}
            </Button>
            <Button variant="ghost" onClick={() => router.push('/register')} className="w-full text-[12px]">
              Try registering again
            </Button>
          </div>
        </div>
      </OnboardingLayout>
    );
  }

  // Waiting for user to check email (no token yet)
  return (
    <OnboardingLayout currentStep={1}>
      <div className="mb-7">
        <span className="text-primary text-4xl font-semibold leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-semibold text-foreground tracking-tight">Check your email</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Step 2 of 7 — Verify Email</p>
      </div>

      <div className="text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-canvas-soft-2 flex items-center justify-center">
          <Mail className="h-8 w-8 text-primary" />
        </div>

        <div>
          <p className="text-sm text-foreground font-medium">We sent a verification link to</p>
          <p className="text-sm text-primary font-semibold mt-1">{email || 'your email address'}</p>
        </div>

        <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
          Click the link in the email to verify your account and continue setting up your studio. The link expires in 24 hours.
        </p>

        {/* Fallback: show direct verification link if email delivery failed */}
        {devVerifyUrl && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-[13px] text-muted-foreground mb-3">
              Having trouble receiving the email? Verify directly using the button below:
            </p>
            <button
              type="button"
              onClick={handleDevVerify}
              className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              Verify My Email →
            </button>
          </div>
        )}

        <div className="pt-2 space-y-3">
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full h-10 text-[13px]"
          >
            {resending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
            ) : cooldown > 0 ? (
              `Resend available in ${cooldown}s`
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" /> Resend verification email</>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/register')}
            className="w-full h-9 text-[12px] text-muted-foreground"
          >
            Use a different email
          </Button>
        </div>

        <p className="text-[12px] text-muted-foreground">
          Didn&apos;t receive it? Check your spam folder or try resending.
        </p>
      </div>
    </OnboardingLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Spinner size="md" label="Loading" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
