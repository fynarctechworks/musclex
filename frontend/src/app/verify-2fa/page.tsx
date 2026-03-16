'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VerifyCodeInput, type VerifyCodeInputRef } from '@/components/shared/verify-code-input';
import { twoFactorApi } from '@/features/auth/two-factor-api';
import { useAuthStore } from '@/stores/auth-store';
import { AuthLayout } from '@/components/auth/auth-layout';
import { toast } from 'sonner';
import Link from 'next/link';
import { Suspense } from 'react';

function Verify2FAForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('token') || '';
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
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

  if (!tempToken) return null;

  return (
    <AuthLayout
      heading="Two-Factor Authentication"
      subheading="Enter the verification code from your authenticator app."
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
        </div>

        {!useBackupCode ? (
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

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(true);
                  setError('');
                }}
                className="text-sm text-primary hover:text-primary/80 underline"
              >
                Use a backup code instead
              </button>
            </div>
          </div>
        ) : (
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

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(false);
                  setError('');
                  setBackupCode('');
                }}
                className="text-sm text-primary hover:text-primary/80 underline"
              >
                Use authenticator code instead
              </button>
            </div>
          </form>
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
