'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Spinner } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { authApi } from '@/features/auth';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';

interface ResetFormData {
  password: string;
  confirm_password: string;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(!!code);
  // The verified Supabase recovery session access token. Sent to the backend,
  // which re-verifies it server-side and derives the user from it — we never
  // send a raw user id (that was an account-takeover hole).
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [exchangeError, setExchangeError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>();

  // Exchange Supabase recovery code for session to get user ID
  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function exchange() {
      try {
        // Also check hash fragment for implicit flow
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');

        let session;

        if (hashAccessToken && hashRefreshToken) {
          // Implicit flow
          const { data, error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });
          if (error) throw error;
          session = data.session;
        } else {
          // PKCE flow
          const { data, error } = await supabase.auth.exchangeCodeForSession(code!);
          if (error) throw error;
          session = data.session;
        }

        if (!session?.access_token) {
          throw new Error('Could not verify recovery link. It may have expired.');
        }

        if (!cancelled) {
          setRecoveryToken(session.access_token);
          setExchanging(false);
        }
      } catch (err) {
        if (!cancelled) {
          setExchangeError(err instanceof Error ? err.message : 'Invalid or expired reset link.');
          setExchanging(false);
        }
      }
    }

    exchange();
    return () => { cancelled = true; };
  }, [code]);

  // Also try to handle hash-only redirects (no code param)
  useEffect(() => {
    if (code || recoveryToken) return;
    const hash = window.location.hash;
    if (!hash) return;

    const hashParams = new URLSearchParams(hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (type === 'recovery' && accessToken && refreshToken) {
      setExchanging(true);
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (error || !data.session?.access_token) {
            setExchangeError('Invalid or expired reset link.');
          } else {
            setRecoveryToken(data.session.access_token);
          }
          setExchanging(false);
        });
    }
  }, [code, recoveryToken]);

  const onSubmit = async (data: ResetFormData) => {
    if (data.password !== data.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    if (!recoveryToken) {
      toast.error('Missing recovery token. Please request a new reset link.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(recoveryToken, data.password);
      setDone(true);
      toast.success('Password reset successfully!');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (exchanging) {
    return (
      <AuthLayout heading="Reset your password" subheading="Verifying your reset link...">
        <div className="text-center py-8 flex justify-center">
          <Spinner size="lg" label="Verifying reset link" />
        </div>
      </AuthLayout>
    );
  }

  if (exchangeError) {
    return (
      <AuthLayout heading="Link expired" subheading="Your password reset link is no longer valid.">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">{exchangeError}</p>
          <Link href="/forgot-password">
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Request a new reset link
            </Button>
          </Link>
          <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-3 w-3" />
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout heading="Password reset!" subheading="You can now sign in with your new password.">
        <div className="text-center space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  // No code/hash — user navigated directly, show error
  if (!recoveryToken && !code) {
    return (
      <AuthLayout heading="Reset your password" subheading="Use the link from your email to reset your password.">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            You need to follow the reset link sent to your email.
          </p>
          <Link href="/forgot-password">
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Request a reset link
            </Button>
          </Link>
          <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-3 w-3" />
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading="Create new password" subheading="Choose a strong password for your account.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">New Password</label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 characters"
              className="h-10 text-[13px] pr-10"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Confirm Password</label>
          <Input
            type="password"
            placeholder="Confirm your password"
            className="h-10 text-[13px]"
            {...register('confirm_password', { required: 'Please confirm your password' })}
          />
          {errors.confirm_password && (
            <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13px]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset Password'}
        </Button>

        <div className="text-center">
          <Link href="/login" className="text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-3 w-3" />
            Back to login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Spinner size="md" label="Loading" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
