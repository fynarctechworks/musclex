'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { ArrowNudge, ButtonLink, cx } from '@/components/ui';
import { annualSavingMonths, formatRupees, type Plan } from '@/lib/plans';
import { productLinks, routes } from '@/lib/site';

type Cycle = 'monthly' | 'annual';

/**
 * Plan cards with the billing-cycle toggle — the only interactive island on
 * this page. Everything below it renders statically on the server.
 */
export function PricingPlans({ plans }: { plans: Plan[] }) {
  const [cycle, setCycle] = useState<Cycle>('monthly');

  return (
    <div className="flex flex-col gap-12">
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Billing cycle"
          className="glass inline-flex items-center gap-1 rounded-pill p-1"
        >
          {(['monthly', 'annual'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={cycle === option}
              onClick={() => setCycle(option)}
              className={cx(
                'rounded-pill px-5 py-2 text-body-sm font-medium transition-all duration-fast',
                cycle === option
                  ? 'bg-text text-white shadow-sm'
                  : 'text-text-3 hover:text-text',
              )}
            >
              {option === 'monthly' ? 'Monthly' : 'Annual'}
              {option === 'annual' ? (
                <span
                  className={cx(
                    'ml-2 text-micro',
                    cycle === 'annual' ? 'text-accent' : 'text-accent',
                  )}
                >
                  2 months free
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isAnnual = cycle === 'annual';
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
          const months = annualSavingMonths(plan);

          return (
            <div
              key={plan.id}
              className={cx(
                'relative flex flex-col gap-5 rounded-lg p-7',
                plan.featured ? 'glass glow-accent' : 'glass glass-hover',
              )}
            >
              {plan.featured ? (
                <span className="absolute -top-3 left-7 rounded-pill bg-accent px-3 py-1 text-micro font-semibold uppercase tracking-[0.1em] text-accent-ink">
                  Popular
                </span>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <h3 className="text-title">{plan.name}</h3>
                <p className="text-body-sm text-text-3">{plan.description}</p>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[38px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                    {formatRupees(price)}
                  </span>
                  <span className="text-body-sm text-text-4">{isAnnual ? '/year' : '/month'}</span>
                </div>
                <p className="mt-2 text-caption text-text-4">
                  {plan.monthlyPrice === 0
                    ? 'Free forever'
                    : isAnnual && months
                      ? `${months} months free vs monthly`
                      : `${formatRupees(plan.annualPrice)} billed annually`}
                </p>
              </div>

              <ul className="flex flex-1 flex-col gap-3 border-t border-hairline pt-5">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-body-sm text-text-3">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={plan.id === 'enterprise' ? routes.contact : productLinks.signup}
                external={plan.id !== 'enterprise'}
                variant={plan.featured ? 'accent' : 'glass'}
                size="md"
                className="w-full"
              >
                {plan.cta}
                {plan.featured ? <ArrowNudge /> : null}
              </ButtonLink>
            </div>
          );
        })}
      </div>

      <p className="text-center text-caption text-text-4">
        Prices in INR, exclusive of applicable taxes.
      </p>
    </div>
  );
}
