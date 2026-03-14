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
      {/* Left gradient panel */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 20% 10%, hsl(155 60% 53%) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, hsl(155 70% 63%) 0%, transparent 55%), radial-gradient(ellipse at 5% 90%, hsl(155 60% 43%) 0%, transparent 40%), hsl(211 53% 11%)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/25 backdrop-blur-sm">
            <Dumbbell className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">FitSync Pro</span>
        </div>

        {/* Bottom copy */}
        <div className="relative">
          <p className="text-white/60 text-xs mb-3 font-medium tracking-wide uppercase">Manage smarter.</p>
          <h2 className="text-white text-[28px] font-bold leading-snug">
            The complete operating system for modern fitness studios.
          </h2>
          <p className="mt-4 text-white/60 text-[13px] leading-relaxed">
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
            <span className="text-primary text-4xl font-black leading-none">*</span>
            <h1 className="mt-2 text-[22px] font-bold text-foreground tracking-tight">{heading}</h1>
            {subheading && (
              <p className="mt-1 text-[13px] text-muted-foreground">{subheading}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
