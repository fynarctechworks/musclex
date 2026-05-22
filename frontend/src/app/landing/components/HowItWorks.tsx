import { UserPlus, ListChecks, ScanLine, TrendingUp, Rocket } from 'lucide-react';

const steps = [
  {
    step: 1,
    icon: UserPlus,
    title: 'Add Members',
    description: 'Register new members with complete profiles and plan details.',
  },
  {
    step: 2,
    icon: ListChecks,
    title: 'Manage Plans',
    description: 'Create membership plans, assign them, and automate renewals.',
  },
  {
    step: 3,
    icon: ScanLine,
    title: 'Track Attendance',
    description: 'QR scan, manual entry, or facial recognition — your choice.',
  },
  {
    step: 4,
    icon: TrendingUp,
    title: 'Monitor Revenue',
    description: 'Real-time financial dashboards with collection tracking.',
  },
  {
    step: 5,
    icon: Rocket,
    title: 'Grow Your Gym',
    description: 'Use AI insights and marketing tools to scale faster.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-b from-gray-50/80 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-link uppercase tracking-wider mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
            Get started in minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Five simple steps to transform how you manage your fitness business.
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((s, i) => (
            <div key={s.step} className="relative group">
              {/* Connector line (hidden on last / mobile) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-gradient-to-r from-blue-200 to-blue-100" />
              )}

              <div className="flex flex-col items-center text-center p-6 bg-canvas rounded-lg border border-hairline hover:shadow-level-4 hover:shadow-gray-100/60 transition-all duration-medium hover:-translate-y-1">
                <div className="relative mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-level-3 shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                    <s.icon className="w-6 h-6 text-on-primary" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-link-soft text-link-deep text-xs font-semibold rounded-full flex items-center justify-center">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
