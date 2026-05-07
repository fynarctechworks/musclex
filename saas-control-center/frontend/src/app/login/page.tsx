'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLogin, useVerifyMfaLogin, useRecoveryLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

type Step = 'credentials' | 'totp' | 'recovery';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const verifyMfa = useVerifyMfaLogin();
  const recoveryLogin = useRecoveryLogin();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [mfaSessionToken, setMfaSessionToken] = useState('');

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.requires_mfa && data.mfa_session_token) {
            setMfaSessionToken(data.mfa_session_token);
            setStep('totp');
          } else {
            router.push('/dashboard');
          }
        },
      },
    );
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    verifyMfa.mutate(
      { mfa_session_token: mfaSessionToken, totp_code: totpCode },
      { onSuccess: () => router.push('/dashboard') },
    );
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    recoveryLogin.mutate(
      { mfa_session_token: mfaSessionToken, recovery_code: recoveryCode },
      { onSuccess: () => router.push('/dashboard') },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold mb-3">
            M
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            MuscleX Control Center
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Sign in to the super admin dashboard
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          {/* Step 1: Credentials */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Email</Label>
                <Input
                  type="email"
                  placeholder="admin@musclex.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px]">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-[12px] text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {login.isError && (
                <p className="text-[13px] text-destructive">
                  {(login.error as Error)?.message || 'Invalid credentials'}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          )}

          {/* Step 2: TOTP */}
          {step === 'totp' && (
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div className="flex flex-col items-center gap-2 mb-2">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <p className="text-[13px] font-medium text-foreground">Two-Factor Authentication</p>
                <p className="text-[12px] text-muted-foreground text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Authentication Code</Label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center tracking-widest text-lg font-mono"
                  autoFocus
                  required
                />
              </div>
              {verifyMfa.isError && (
                <p className="text-[13px] text-destructive">
                  {(verifyMfa.error as Error)?.message || 'Invalid code'}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={verifyMfa.isPending}>
                {verifyMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
              <button
                type="button"
                onClick={() => setStep('recovery')}
                className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Lost your phone? Use a recovery code
              </button>
            </form>
          )}

          {/* Step 2b: Recovery code */}
          {step === 'recovery' && (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="flex flex-col items-center gap-2 mb-2">
                <ShieldCheck className="h-8 w-8 text-warning" />
                <p className="text-[13px] font-medium text-foreground">Recovery Code</p>
                <p className="text-[12px] text-muted-foreground text-center">
                  Enter one of the 8-character recovery codes you saved when setting up 2FA
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Recovery Code</Label>
                <Input
                  type="text"
                  placeholder="ABCD-1234"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  className="text-center tracking-widest font-mono"
                  autoFocus
                  required
                />
              </div>
              {recoveryLogin.isError && (
                <p className="text-[13px] text-destructive">
                  {(recoveryLogin.error as Error)?.message || 'Invalid recovery code'}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={recoveryLogin.isPending}>
                {recoveryLogin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In with Recovery Code
              </Button>
              <button
                type="button"
                onClick={() => setStep('totp')}
                className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Back to authenticator code
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
