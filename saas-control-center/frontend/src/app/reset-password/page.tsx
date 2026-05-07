'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useResetPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [matchError, setMatchError] = useState('');
  const resetPassword = useResetPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMatchError('Passwords do not match');
      return;
    }
    setMatchError('');
    resetPassword.mutate(
      { token, new_password: password },
      {
        onSuccess: () => {
          setDone(true);
          setTimeout(() => router.push('/login'), 2000);
        },
      },
    );
  };

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-[13px] text-destructive">Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="mt-2 block text-[13px] text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return done ? (
    <div className="flex flex-col items-center gap-3 py-2">
      <CheckCircle2 className="h-10 w-10 text-success" />
      <p className="text-[14px] font-medium text-foreground">Password updated!</p>
      <p className="text-[13px] text-muted-foreground">Redirecting to sign in…</p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[13px]">New Password</Label>
        <Input
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[13px]">Confirm Password</Label>
        <Input
          type="password"
          placeholder="Repeat your new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {matchError && <p className="text-[13px] text-destructive">{matchError}</p>}
      {resetPassword.isError && (
        <p className="text-[13px] text-destructive">
          {(resetPassword.error as Error)?.message || 'Reset link is invalid or expired'}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
        {resetPassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Set New Password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold mb-3">
            M
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Set New Password
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Choose a new password for your account
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <Suspense fallback={<p className="text-[13px] text-muted-foreground">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
