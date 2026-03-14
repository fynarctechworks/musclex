import Link from 'next/link';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '₹999',
    period: '/month',
    description: 'Perfect for small gyms just getting started.',
    features: [
      'Up to 100 Members',
      'Attendance Tracking',
      'Billing System',
      'Basic Analytics',
      'Email Support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    price: '₹1,999',
    period: '/month',
    description: 'For growing gyms that need more power.',
    features: [
      'Unlimited Members',
      'Trainer Management',
      'Advanced Analytics',
      'Marketing Automation',
      'QR & Facial Check-in',
      'Priority Support',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For multi-branch fitness chains.',
    features: [
      'Multiple Branches',
      'Full API Access',
      'Dedicated Account Manager',
      'Custom Integrations',
      'SLA Guarantee',
      'On-premise Option',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            No hidden fees. Start free and upgrade when you&apos;re ready.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-7 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                plan.popular
                  ? 'border-blue-200 bg-gradient-to-b from-blue-50/60 to-white shadow-xl shadow-blue-100/40'
                  : 'border-gray-100 bg-white hover:shadow-lg hover:shadow-gray-100/60'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold rounded-full shadow-md">
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1 mb-5">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                {plan.period && (
                  <span className="text-base text-gray-400 font-medium">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.name === 'Enterprise' ? '/onboarding' : '/onboarding'}
                className={`block text-center px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  plan.popular
                    ? 'text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md shadow-blue-500/25 hover:shadow-blue-500/40'
                    : 'text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
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
