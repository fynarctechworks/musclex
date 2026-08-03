import Link from 'next/link';
import { Check } from 'lucide-react';

/**
 * SOURCE OF TRUTH: `backend/src/common/plan-configs.ts` (PLAN_CONFIGS) — the
 * same limits/prices the resource-limit service enforces. Keep these in sync;
 * there is no public pricing API to read them from yet (see DEBT.md).
 * Annual prices are ~2 months free (e.g. Starter ₹9,990/yr vs ₹11,988).
 */
const plans = [
  {
    name: 'Free',
    price: '₹0',
    period: '/month',
    description: 'Basic gym management for a single location.',
    features: [
      'Up to 50 members',
      '1 branch · up to 3 staff',
      'Check-in & attendance',
      'Manual payments & invoices',
      'Basic reports',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Starter',
    price: '₹999',
    period: '/month',
    description: 'Growing gyms with staff and class management.',
    features: [
      'Up to 200 members',
      '1 branch · up to 10 staff',
      'Class scheduling',
      'Online payments (Razorpay)',
      'WhatsApp notifications',
      'Audit logs',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Pro',
    price: '₹2,499',
    period: '/month',
    description: 'Multi-branch fitness chains with advanced features.',
    features: [
      'Up to 1,000 members',
      'Up to 5 branches · 50 staff',
      'Marketing campaigns & email',
      'AI advisor',
      'Custom roles & API access',
      'Everything in Starter',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '₹4,999',
    period: '/month',
    description: 'Unlimited scale for large fitness organizations.',
    features: [
      'Unlimited members & branches',
      '100 GB storage',
      'Full API access',
      'Priority support',
      'Everything in Pro',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-link uppercase tracking-wider mb-3">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No hidden fees. Start free and upgrade when you&apos;re ready.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-7 rounded-lg border transition-all duration-medium hover:-translate-y-1 ${
                plan.popular
                  ? 'border-link/30 bg-gradient-to-b from-blue-50/60 to-white shadow-level-5 shadow-blue-100/40'
                  : 'border-hairline bg-canvas hover:shadow-level-4 hover:shadow-gray-100/60'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-on-primary text-xs font-semibold rounded-full shadow-level-3">
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-semibold text-foreground">{plan.price}</span>
                {plan.period && (
                  <span className="text-base text-muted-foreground font-medium">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-link flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/onboarding"
                className={`block text-center px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-fast ${
                  plan.popular
                    ? 'text-on-primary bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-level-3 shadow-blue-500/25 hover:shadow-blue-500/40'
                    : 'text-foreground bg-canvas-soft border border-hairline hover:bg-canvas-soft-2 hover:border-hairline-strong'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
