'use client';

import { Dumbbell } from 'lucide-react';

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
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden surface-ink">
        {/* Mesh gradient atmosphere — Design.md brand chrome */}
        <div
          className="bg-mesh-brand absolute inset-0 opacity-40 pointer-events-none"
          aria-hidden
        />

        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-on-primary/10 ring-1 ring-on-primary/10">
            <Dumbbell className="h-4 w-4 text-on-primary" />
          </div>
          <span className="text-sm font-semibold text-on-primary tracking-[-0.01em]">
            MuscleX
          </span>
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
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary">
            <Dumbbell className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-[-0.01em]">
            MuscleX
          </span>
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
