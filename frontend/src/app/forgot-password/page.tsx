'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/features/auth';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>();

  const onSubmit = async (data: { email: string }) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      setSent(true);
      toast.success('Password reset email sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout heading="Check your email" subheading="We've sent a password reset link to your email.">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Mail className="mx-auto h-12 w-12 text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Follow the instructions in the email to create a new password.
            The link will expire in 1 hour.
          </p>
          <Link href="/login">
            <Button variant="ghost" className="mt-4 text-primary hover:text-primary/80">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading="Reset your password" subheading="Enter your email and we'll send you a reset link.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Email</label>
          <Input
            type="email"
            placeholder="you@example.com"
            className="h-10 text-[13px]"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13px]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Link'}
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
