'use client';

import { Check, User, Mail, Zap, Building2, Dumbbell } from 'lucide-react';

const STEPS = [
  { label: 'Create Account', icon: User },
  { label: 'Verify Email', icon: Mail },
  { label: 'Choose Plan', icon: Zap },
  { label: 'Set Up Studio', icon: Building2 },
];

interface OnboardingLayoutProps {
  currentStep: number;
  children: React.ReactNode;
  maxWidth?: string;
}

export function OnboardingLayout({
  currentStep,
  children,
  maxWidth = '380px',
}: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left gradient panel ── */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 20% 10%, hsl(155 60% 53%) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, hsl(155 70% 63%) 0%, transparent 55%), radial-gradient(ellipse at 5% 90%, hsl(155 60% 43%) 0%, transparent 40%), hsl(211 53% 11%)',
        }}
      >
        {/* subtle noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/25 backdrop-blur-sm">
            <Dumbbell className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">
            FitSync Pro
          </span>
        </div>

        {/* Step indicator */}
        <div className="relative space-y-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isComplete = i < currentStep;
            const isCurrent = i === currentStep;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isComplete
                      ? 'bg-white text-[#0D1B2A]'
                      : isCurrent
                        ? 'bg-white/90 text-[#0D1B2A] ring-2 ring-white ring-offset-2 ring-offset-transparent'
                        : 'bg-white/20 text-white'
                  }`}
                >
                  {isComplete ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={`text-[13px] font-medium ${
                    i <= currentStep ? 'text-white' : 'text-white/50'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom copy */}
        <div className="relative">
          <p className="text-white/60 text-xs mb-3 font-medium tracking-wide uppercase">
            Get started free.
          </p>
          <h2 className="text-white text-[26px] font-bold leading-snug">
            Your studio is minutes away from going digital.
          </h2>
          <p className="mt-4 text-white/60 text-[13px] leading-relaxed">
            Set up once, manage everything — members, payments, classes, and
            team.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-[15px]">
            FitSync Pro
          </span>
        </div>

        {/* Mobile step pills */}
        <div className="lg:hidden flex items-center gap-2 mb-6 w-full max-w-md">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= currentStep ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        <div className="w-full" style={{ maxWidth }}>
          {children}
        </div>
      </div>
    </div>
  );
}
