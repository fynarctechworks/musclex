'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForgotPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const forgotPassword = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPassword.mutate(email, {
      onSuccess: () => setSubmitted(true),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold mb-3">
            M
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Reset Password
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Enter your email to receive a reset link
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-[14px] font-medium text-foreground text-center">Check your email</p>
              <p className="text-[13px] text-muted-foreground text-center">
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
              </p>
              <Link
                href="/login"
                className="mt-2 text-[13px] text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {forgotPassword.isError && (
                <p className="text-[13px] text-destructive">
                  {(forgotPassword.error as Error)?.message || 'Something went wrong'}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
              <div className="text-center">
                <Link href="/login" className="text-[12px] text-muted-foreground hover:text-foreground">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
