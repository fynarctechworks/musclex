'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Spinner } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SocialAuthButtons, AuthDivider } from '@/components/auth/social-auth-buttons';

interface LoginFormData {
  email: string;
  password: string;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get('expired');
  const { login, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  // Show expired session message once
  if (expired === 'true') {
    toast.info('Your session expired. Please sign in again.', { id: 'session-expired' });
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.toLowerCase().includes('verify your email')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <AuthLayout heading="Sign in to your studio" subheading="Enter your credentials to access your dashboard.">
      <SocialAuthButtons providers={['google', 'apple']} disabled={loading} />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground leading-5">Email</label>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@studio.com"
            aria-invalid={!!errors.email}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p className="text-xs text-error-deep">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground leading-5">Password</label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="············"
              className="pr-10"
              aria-invalid={!!errors.password}
              {...register('password', { required: 'Password is required' })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-error-deep">{errors.password.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-link hover:text-link-deep transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="md" disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to MuscleX?{' '}
        <Link href="/register" className="text-link font-medium hover:text-link-deep hover:underline">
          Set up your studio
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Spinner size="md" label="Loading sign in" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
