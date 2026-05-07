'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VerifyCodeInput, type VerifyCodeInputRef } from '@/components/shared/verify-code-input';
import { twoFactorApi } from '@/features/auth/two-factor-api';
import { useAuthStore } from '@/stores/auth-store';
import { AuthLayout } from '@/components/auth/auth-layout';
import { toast } from 'sonner';
import Link from 'next/link';
import { Suspense } from 'react';

type ViewMode = 'totp' | 'backup' | 'recovery';

function Verify2FAForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('token') || '';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('totp');
  const [backupCode, setBackupCode] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const codeInputRef = useRef<VerifyCodeInputRef>(null);

  useEffect(() => {
    if (!tempToken) {
      router.replace('/login');
    }
  }, [tempToken, router]);

  const handleVerify = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await twoFactorApi.verifyLogin(tempToken, code);
      // Set auth state
      setAuth({
        user: data.user as never,
        studio: data.studio as never,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      toast.success('Welcome back!');

      if (data.requires_workspace_selection) {
        router.push('/workspace-select');
      } else {
        // Get studio slug for redirect
        const studio = data.studio as Record<string, unknown> | null;
        const slug = studio?.slug as string;
        router.push(slug ? `/${slug}/dashboard` : '/login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      setError(msg);
      toast.error(msg);
      // Clear OTP inputs so user can re-enter
      codeInputRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleBackupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (backupCode.trim()) {
      handleVerify(backupCode.trim());
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setLoading(true);
    setError('');
    try {
      await twoFactorApi.requestRecovery(recoveryEmail.trim());
      setRecoverySent(true);
      toast.success('Recovery email sent!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send recovery email';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode: ViewMode) => {
    setViewMode(mode);
    setError('');
    setBackupCode('');
    setRecoveryEmail('');
    setRecoverySent(false);
  };

  if (!tempToken) return null;

  return (
    <AuthLayout
      heading={
        viewMode === 'recovery'
          ? 'Account Recovery'
          : 'Two-Factor Authentication'
      }
      subheading={
        viewMode === 'recovery'
          ? "Lost your authenticator? We'll send a recovery link to your email."
          : 'Enter the verification code from your authenticator app.'
      }
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {viewMode === 'recovery' ? (
              <Mail className="h-8 w-8 text-primary" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-primary" />
            )}
          </div>
        </div>

        {/* ── TOTP Code Entry ── */}
        {viewMode === 'totp' && (
          <div className="space-y-4">
            <VerifyCodeInput
              ref={codeInputRef}
              onComplete={handleVerify}
              disabled={loading}
              error={!!error}
            />

            {loading && (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <p className="text-sm text-center text-destructive">{error}</p>
            )}

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => switchMode('backup')}
                className="text-sm text-primary hover:text-primary/80 underline block mx-auto"
              >
                Use a backup code instead
              </button>
              <button
                type="button"
                onClick={() => switchMode('recovery')}
                className="text-sm text-muted-foreground hover:text-foreground underline block mx-auto"
              >
                Lost your authenticator?
              </button>
            </div>
          </div>
        )}

        {/* ── Backup Code Entry ── */}
        {viewMode === 'backup' && (
          <form onSubmit={handleBackupSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">
                Backup Code
              </label>
              <Input
                type="text"
                placeholder="XXXX-XXXX"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                className="h-10 text-center font-mono text-lg tracking-widest"
                autoFocus
                maxLength={9}
              />
            </div>

            {error && (
              <p className="text-sm text-center text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !backupCode.trim()}
              className="w-full h-10"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify Backup Code
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => switchMode('totp')}
                className="text-sm text-primary hover:text-primary/80 underline block mx-auto"
              >
                Use authenticator code instead
              </button>
              <button
                type="button"
                onClick={() => switchMode('recovery')}
                className="text-sm text-muted-foreground hover:text-foreground underline block mx-auto"
              >
                Lost your authenticator?
              </button>
            </div>
          </form>
        )}

        {/* ── Recovery Flow ── */}
        {viewMode === 'recovery' && (
          <div className="space-y-4">
            {!recoverySent ? (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">
                    Account Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-center text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading || !recoveryEmail.trim()}
                  className="w-full h-10"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Recovery Link
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('totp')}
                    className="text-sm text-primary hover:text-primary/80 underline"
                  >
                    Back to verification code
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Recovery email sent!
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Check your email for a recovery link. The link expires in 10 minutes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode('totp')}
                  className="text-sm text-primary hover:text-primary/80 underline"
                >
                  Back to verification code
                </button>
              </div>
            )}
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

export default function Verify2FAPage() {
  return (
    <Suspense>
      <Verify2FAForm />
    </Suspense>
  );
}

