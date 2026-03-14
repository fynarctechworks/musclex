'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/features/auth';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

interface RegisterFormData {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        phone: data.phone,
      });

      // Store email for verify page to display
      sessionStorage.setItem('pendingEmail', data.email);
      toast.success('Account created! Check your email for a verification link.');
      router.push('/verify-email');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout currentStep={0}>
      <div className="mb-7">
        <span className="text-primary text-4xl font-black leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-bold text-foreground tracking-tight">
          Create your account
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step 1 of 4 — Create Account
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2 text-primary mb-2">
          <User className="h-4 w-4" />
          <span className="text-[13px] font-semibold">Your Details</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Full Name *</label>
          <Input
            placeholder="Your full name"
            className="h-10 text-[13px]"
            {...register('full_name', { required: 'Name is required' })}
          />
          {errors.full_name && (
            <p className="text-xs text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Email *</label>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Password *</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars"
                className="h-10 text-[13px] pr-9"
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Min 8 characters' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Confirm *</label>
            <Input
              type="password"
              placeholder="Confirm"
              className="h-10 text-[13px]"
              {...register('confirm_password', { required: 'Confirm your password' })}
            />
            {errors.confirm_password && (
              <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Phone Number *</label>
          <Input
            placeholder="Your phone number"
            className="h-10 text-[13px]"
            {...register('phone', { required: 'Phone number is required' })}
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </OnboardingLayout>
  );
}
