'use client';

import Silk from '@/components/ui/silk';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading: string;
  subheading?: string;
}

/**
 * Auth layout — Design.md split shell.
 *
 * Left rail: polarity-flipped ink band hosting the brand mesh gradient
 * (atmospheric backdrop at hero scale only — never miniaturised).
 * Right rail: canvas form panel with the display-md heading.
 */
export function AuthLayout({ children, heading, subheading }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-canvas-soft">
      {/* Left brand panel — ink surface with mesh gradient backdrop */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden bg-[#0a0a0a]">
        {/* Animated silk backdrop — brand chrome, hero scale only */}
        <div className="absolute inset-0 pointer-events-none bg-[#0a0a0a]">
          <Silk color="#7B7481" speed={5} scale={1} noiseIntensity={1.5} rotation={0} />
        </div>
        {/* Subtle bottom fade — keeps the white copy legible over the silk */}
        <div
          className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-transparent"
          aria-hidden
        />

        {/* Logo */}
        <div className="relative flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark-light.png" alt="MuscleX" className="h-6 w-auto" />
        </div>

        {/* Bottom copy */}
        <div className="relative max-w-md">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-on-primary/60 mb-3">
            Manage smarter.
          </p>
          <h2 className="text-display-lg text-on-primary">
            The complete operating system for modern fitness studios.
          </h2>
          <p className="mt-4 text-body-md text-on-primary/60 leading-relaxed">
            Members, check-ins, payments, classes and AI insights — all in one
            place.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-canvas">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.png" alt="MuscleX" className="h-6 w-auto" />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-7">
            <h1 className="text-display-sm text-foreground">{heading}</h1>
            {subheading && (
              <p className="mt-2 text-body-sm text-muted-foreground">
                {subheading}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
