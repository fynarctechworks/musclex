import type { Metadata } from 'next';
import { Check, Minus } from 'lucide-react';
import { HeroBackdrop, Section, SectionHeading } from '@/components/ui';
import { FinalCta } from '@/components/final-cta';
import { PricingPlans } from './pricing-plans';
import { UNLIMITED_AT, featureLabels, formatLimit, formatRupees, type Plan } from '@/lib/plans';
import { getPlans } from '@/lib/plans-source';
import { routes, salesEmail } from '@/lib/site';

/**
 * Revalidate the live plan catalogue every 5 minutes.
 *
 * Set at page level (not just on the fetch) so the ISR behaviour is explicit
 * and does not depend on Next's fetch-cache heuristics — a plan edited in the
 * SCC appears here within this window without a redeploy.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'MuscleX pricing: a free plan for up to 50 members, Starter at ₹999/month, Pro at ₹2,499/month and Enterprise at ₹4,999/month. Annual billing takes two months off.',
  alternates: { canonical: routes.pricing },
};

const faqs = [
  {
    q: 'Is the Free plan really free?',
    a: 'Yes. Up to 50 members, one branch and three staff, with check-in, manual payments, invoices and basic reports. No card is required to start, and it does not expire.',
  },
  {
    q: 'What happens when I pass a plan limit?',
    a: 'Limits are enforced by the product, not by a surprise invoice. When you approach the member, branch or staff ceiling on your plan you will be prompted to upgrade before you are blocked from adding more.',
  },
  {
    q: 'Can I change plans mid-cycle?',
    a: 'Yes. Upgrades and downgrades are prorated, so what you pay reflects the part of the cycle you actually used on each plan.',
  },
  {
    q: 'How does annual billing work?',
    a: 'You pay for ten months and get twelve. Starter is ₹9,990 a year against ₹11,988 monthly; Pro is ₹24,990 against ₹29,988; Enterprise is ₹49,990 against ₹59,988.',
  },
  {
    q: 'Which plan do I need for multiple branches?',
    a: 'Pro. It covers up to five branches and fifty staff. Enterprise removes the branch and member ceilings entirely.',
  },
  {
    q: 'Do you charge per member or per staff seat?',
    a: 'Neither. You pay per studio, and each plan carries member, branch and staff ceilings. Adding a front-desk login does not add to the bill.',
  },
  {
    q: 'What payment methods can I collect from members?',
    a: 'Online collection runs through Razorpay from the Starter plan upward, including a hosted checkout page members can open on their phone. Manual and at-the-desk payments are available on every plan, including Free.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes. Reports export from the product, and Pro and Enterprise add API access for anything you want to pull programmatically.',
  },
];

// Server component: reads the live catalogue from the SCC (see plans-source).
export default async function PricingPage() {
  const { plans } = await getPlans();

  return (
    <>
      {/* ── Header + plan cards ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
        <HeroBackdrop />
        <div className="container-page relative flex flex-col gap-16">
          <div className="mx-auto flex max-w-[760px] flex-col items-center gap-5 text-center">
            <p className="eyebrow">pricing</p>
            <h1 className="text-[40px] leading-[1.04] tracking-[-0.04em] sm:text-[58px] lg:text-display-2">
              Simple, <span className="text-gradient">transparent</span> pricing.
            </h1>
            <p className="max-w-[620px] text-lead text-text-2">
              Start free and upgrade when your member count says so. No setup fees, no
              per-seat charges, no hidden line items.
            </p>
          </div>
          <PricingPlans plans={plans} />
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <Section tone="deep" id="compare">
        <div className="container-page">
          <SectionHeading
            eyebrow="compare"
            title="Every plan, feature by feature."
            lead="The same limits and entitlements the product enforces. Nothing here is marketing rounding."
          />

          <div className="glass mt-16 overflow-x-auto rounded-lg">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <caption className="sr-only">
                MuscleX plan comparison across limits and sixteen feature entitlements
              </caption>
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="px-6 py-5 text-micro font-medium uppercase tracking-[0.12em] text-text-4">
                    Plan
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.id} scope="col" className="px-4 py-5">
                      <span className="block text-body-sm font-semibold">{plan.name}</span>
                      <span className="block text-caption tabular-nums text-text-4">
                        {plan.monthlyPrice === 0 ? 'Free' : `${formatRupees(plan.monthlyPrice)}/mo`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <GroupRow label="Limits" plans={plans} />
                {(
                  [
                    ['Members', (p: Plan) => formatLimit(p.maxMembers, UNLIMITED_AT.members)],
                    ['Branches', (p: Plan) => formatLimit(p.maxBranches, UNLIMITED_AT.branches)],
                    ['Staff accounts', (p: Plan) => formatLimit(p.maxStaff, UNLIMITED_AT.staff)],
                    ['Storage', (p: Plan) => `${p.storageGb} GB`],
                  ] as const
                ).map(([label, get]) => (
                  <tr key={label} className="border-b border-hairline">
                    <th scope="row" className="px-6 py-3.5 text-body-sm font-normal text-text-3">
                      {label}
                    </th>
                    {plans.map((plan) => (
                      <td key={plan.id} className="px-4 py-3.5 text-body-sm tabular-nums">
                        {get(plan)}
                      </td>
                    ))}
                  </tr>
                ))}

                {['Core', 'Operations', 'Scale'].map((group) => (
                  <FeatureGroupRows key={group} group={group} plans={plans} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-caption text-text-4">
            Enterprise limits shown as &ldquo;Unlimited&rdquo; are configured without a practical
            ceiling.
          </p>
        </div>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <SectionHeading eyebrow="questions" title="Pricing questions, answered." />

          <dl className="mx-auto mt-16 grid max-w-[960px] gap-4 sm:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="glass glass-hover flex flex-col gap-2.5 rounded-lg p-6">
                <dt className="text-title-sm">{faq.q}</dt>
                <dd className="text-body-sm text-text-3">{faq.a}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-12 text-center text-body-sm text-text-3">
            Something not covered here?{' '}
            <a
              href={`mailto:${salesEmail}`}
              className="text-text underline decoration-hairline-strong underline-offset-4 transition-colors duration-fast hover:decoration-accent"
            >
              Ask us directly
            </a>
            .
          </p>
        </div>
      </Section>

      <FinalCta
        title="Start on the free plan today."
        lead="Up to 50 members, one branch and full check-in, with no card and no trial clock."
      />
    </>
  );
}

function GroupRow({ label, plans }: { label: string; plans: Plan[] }) {
  return (
    <tr className="border-b border-hairline bg-glass-1">
      <th
        scope="colgroup"
        colSpan={plans.length + 1}
        className="px-6 py-2.5 text-micro font-medium uppercase tracking-[0.12em] text-text-4"
      >
        {label}
      </th>
    </tr>
  );
}

/** One grouped block of feature-flag rows inside the comparison table. */
function FeatureGroupRows({ group, plans }: { group: string; plans: Plan[] }) {
  const rows = featureLabels.filter((f) => f.group === group);

  return (
    <>
      <GroupRow label={group} plans={plans} />
      {rows.map((row) => (
        <tr key={row.flag} className="border-b border-hairline last:border-b-0">
          <th scope="row" className="px-6 py-3.5 text-body-sm font-normal text-text-3">
            {row.label}
          </th>
          {plans.map((plan) => (
            <td key={plan.id} className="px-4 py-3.5">
              {plan.features[row.flag] ? (
                <Check className="h-4 w-4 text-accent" aria-label="Included" />
              ) : (
                <Minus className="h-4 w-4 text-text-4" aria-label="Not included" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
