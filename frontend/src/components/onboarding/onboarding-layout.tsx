'use client';

import { Check, User, Mail, Building2, MapPin, CreditCard, Users, Zap, Dumbbell } from 'lucide-react';

const STEPS = [
  { label: 'Create Account', icon: User },
  { label: 'Verify Email', icon: Mail },
  { label: 'Studio Info', icon: Building2 },
  { label: 'Branches', icon: MapPin },
  { label: 'Membership Plans', icon: CreditCard },
  { label: 'Staff', icon: Users },
  { label: 'Choose Plan', icon: Zap },
];

interface OnboardingLayoutProps {
  currentStep: number;
  children: React.ReactNode;
  maxWidth?: string;
  hideSidebar?: boolean;
}

export function OnboardingLayout({
  currentStep,
  children,
  maxWidth = '480px',
  hideSidebar = false,
}: OnboardingLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Left dark panel ── */}
      {!hideSidebar && (
        <div
          className="hidden lg:flex lg:h-screen lg:w-[44%] lg:shrink-0 flex-col justify-between p-10 relative overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse at 20% 10%, hsl(0 0% 98% / 0.08) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, hsl(0 0% 98% / 0.05) 0%, transparent 55%), hsl(0 0% 7%)',
          }}
        >
        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas/15">
            <Dumbbell className="h-4 w-4 text-on-primary" />
          </div>
          <span className="text-[15px] font-semibold text-on-primary tracking-tight">
            MuscleX
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
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isComplete
                      ? 'bg-foreground text-background'
                      : isCurrent
                        ? 'bg-canvas/90 text-[#111] ring-2 ring-white ring-offset-2 ring-offset-transparent'
                        : 'bg-canvas/15 text-on-primary/60'
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
                    i <= currentStep ? 'text-on-primary' : 'text-on-primary/40'
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
          <p className="text-on-primary/40 text-xs mb-3 font-medium tracking-wide uppercase">
            Get started free.
          </p>
          <h2 className="text-on-primary text-[26px] font-semibold leading-snug">
            Your studio is minutes away from going digital.
          </h2>
          <p className="mt-4 text-on-primary/50 text-[13px] leading-relaxed">
            Set up once, manage everything — members, payments, classes, and
            team.
          </p>
        </div>
        </div>
      )}

      {/* ── Right form panel ── */}
      <div className="flex h-screen flex-1 overflow-y-auto bg-background">
        <div className="flex min-h-full w-full flex-col items-center justify-start px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-[15px]">
            MuscleX
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

        <div className="w-full" style={{ maxWidth, minWidth: 0 }}>
          {children}
        </div>
        </div>
      </div>
    </div>
  );
}
