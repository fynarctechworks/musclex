'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldOff, Loader2, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { twoFactorApi } from '@/features/auth/two-factor-api';
import { AuthLayout } from '@/components/auth/auth-layout';
import { toast } from 'sonner';
import Link from 'next/link';
import { Suspense } from 'react';

function Reset2FAForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');
    try {
      await twoFactorApi.resetWithRecovery(token, password);
      setResetComplete(true);
      toast.success('Two-factor authentication has been reset.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reset 2FA';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <AuthLayout
      heading={resetComplete ? '2FA Reset Complete' : 'Reset Two-Factor Authentication'}
      subheading={
        resetComplete
          ? undefined
          : 'Confirm your password to disable 2FA on your account.'
      }
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              resetComplete ? 'bg-success/10' : 'bg-destructive/10'
            }`}
          >
            {resetComplete ? (
              <CheckCircle2 className="h-8 w-8 text-success" />
            ) : (
              <ShieldOff className="h-8 w-8 text-destructive" />
            )}
          </div>
        </div>

        {!resetComplete ? (
          <form onSubmit={handleReset} className="space-y-4">
            {/* Security warning */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
              <div className="flex gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  This will disable two-factor authentication on your account. You will need to set it up again after logging in.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Enter your account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
                autoFocus
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-center text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !password.trim()}
              variant="destructive"
              className="w-full h-10"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Two-Factor Authentication
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Your two-factor authentication has been disabled. Please log in again and set up 2FA to keep your account secure.
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="w-full h-10"
            >
              Go to Login
            </Button>
          </div>
        )}

        <div className="text-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function Reset2FAPage() {
  return (
    <Suspense>
      <Reset2FAForm />
    </Suspense>
  );
}
