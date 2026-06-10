import Link from 'next/link';
import {
  BarChart3,
  Users,
  CreditCard,
  CalendarCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

/**
 * Hero — Design.md hero band.
 *
 * Atmospheric backdrop: `.bg-mesh-brand` (the brand's only decorative chrome,
 * hero scale only). Foreground: display-xl headline, body-lg lead, primary
 * pill CTA paired with secondary outline.
 */
export default function HeroSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-canvas">
      {/* Brand mesh gradient atmosphere — Design.md hero treatment. */}
      <div className="bg-mesh-brand absolute inset-0 opacity-50 pointer-events-none" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-canvas border border-hairline rounded-full shadow-level-1">
              <Sparkles className="w-3.5 h-3.5 text-foreground" />
              <span className="text-caption-mono">AI-Powered Platform</span>
            </div>

            <h1 className="text-display-xl text-foreground lg:text-[64px] lg:leading-[1.05] lg:tracking-[-0.04em]">
              All-in-one gym management software.
            </h1>

            <p className="text-body-lg text-muted-foreground leading-relaxed max-w-xl">
              Manage members, trainers, payments, attendance and gym analytics
              from one powerful dashboard. Built for modern fitness businesses.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 text-base font-medium text-primary-foreground bg-primary rounded-pill shadow-level-2 hover:shadow-level-3 transition-shadow duration-fast ease-out group focus-ring"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-fast" />
              </Link>
              <button
                onClick={() => scrollTo('pricing')}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 text-base font-medium text-foreground bg-canvas border border-hairline rounded-pill shadow-level-1 hover:bg-canvas-soft transition-colors duration-fast ease-out focus-ring"
              >
                View Pricing
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full bg-canvas-soft-2 border-2 border-canvas flex items-center justify-center text-xs font-semibold text-foreground shadow-level-1"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">500+</span> gyms already
                onboard
              </p>
            </div>
          </div>

          {/* Right — Dashboard mockup */}
          <div className="relative lg:pl-8">
            <div className="relative bg-card rounded-lg shadow-level-5 border border-hairline overflow-hidden">
              {/* Title Bar */}
              <div className="flex items-center gap-2 px-5 py-3.5 bg-canvas-soft border-b border-hairline">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-error" />
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <div className="w-3 h-3 rounded-full bg-success" />
                </div>
                <span className="ml-3 font-mono text-[11px] text-muted-foreground">
                  MuscleX — Dashboard
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Members', value: '1,284', icon: Users },
                    { label: 'Revenue', value: '₹4.2L', icon: CreditCard },
                    { label: 'Check-ins', value: '342', icon: CalendarCheck },
                    { label: 'Growth', value: '+18%', icon: BarChart3 },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="p-3 bg-canvas border border-hairline rounded-md"
                    >
                      <div className="w-8 h-8 bg-canvas-soft-2 text-foreground rounded-sm flex items-center justify-center mb-2">
                        <kpi.icon className="w-4 h-4" />
                      </div>
                      <p className="text-lg font-semibold text-foreground tabular-nums">
                        {kpi.value}
                      </p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {kpi.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Chart placeholder — neutral ink bars on canvas-soft */}
                <div className="h-32 bg-canvas-soft rounded-md border border-hairline flex items-end px-4 pb-3 gap-2">
                  {[40, 65, 50, 80, 60, 90, 75, 95, 70, 85, 88, 92].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary rounded-t-sm opacity-80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-5 -left-5 bg-card rounded-lg shadow-level-4 border border-hairline p-4 hidden lg:flex items-center gap-3">
              <div className="w-10 h-10 bg-canvas-soft-2 rounded-sm flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Today&apos;s Check-ins
                </p>
                <p className="text-xs text-muted-foreground">342 members checked in</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
