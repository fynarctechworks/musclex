import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * CTA — final conversion band.
 *
 * Polarity-flipped ink surface with the brand mesh gradient as atmospheric
 * backdrop. Primary CTA is the canonical white pill on ink (Design.md
 * `button-secondary` paired with the ink card).
 */
export default function CTA() {
  return (
    <section className="py-20 lg:py-28 bg-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-lg surface-ink px-8 py-16 sm:px-16 sm:py-20 text-center">
          {/* Mesh gradient atmosphere — Design.md hero treatment. */}
          <div
            className="bg-mesh-brand absolute inset-0 opacity-40 pointer-events-none"
            aria-hidden
          />

          <div className="relative space-y-6 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-on-primary/10 border border-on-primary/20 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-on-primary/80" />
              <span className="text-caption-mono !text-on-primary/80">14-day free trial</span>
            </div>

            <h2 className="text-display-lg sm:text-display-xl text-on-primary leading-tight">
              Start managing your gym the smart way.
            </h2>

            <p className="text-body-md text-on-primary/70 max-w-lg mx-auto">
              Join 500+ gym owners who modernized their operations with MuscleX.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 text-base font-medium text-foreground bg-canvas rounded-pill hover:bg-canvas-soft shadow-level-2 transition-colors duration-fast ease-out group focus-ring"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-fast" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 text-base font-medium text-on-primary bg-on-primary/10 border border-on-primary/20 rounded-pill hover:bg-on-primary/15 transition-colors duration-fast ease-out focus-ring"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
