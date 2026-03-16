'use client';

import { Dumbbell } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading: string;
  subheading?: string;
}

export function AuthLayout({ children, heading, subheading }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left brand panel — dark with green accents */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 20% 10%, hsl(153 60% 53% / 0.15) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, hsl(153 60% 53% / 0.10) 0%, transparent 55%), hsl(0 0% 7%)',
        }}
      >
        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ECF8E]/20">
            <Dumbbell className="h-4 w-4 text-[#3ECF8E]" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">FitSync Pro</span>
        </div>

        {/* Bottom copy */}
        <div className="relative">
          <p className="text-white/40 text-xs mb-3 font-medium tracking-wide uppercase">Manage smarter.</p>
          <h2 className="text-white text-[28px] font-bold leading-snug">
            The complete operating system for modern fitness studios.
          </h2>
          <p className="mt-4 text-white/50 text-[13px] leading-relaxed">
            Members, check-ins, payments, classes and AI insights — all in one place.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-[15px]">FitSync Pro</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-7">
            <h1 className="text-[22px] font-bold text-foreground tracking-tight">{heading}</h1>
            {subheading && (
              <p className="mt-1.5 text-[13px] text-muted-foreground">{subheading}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
