import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Check,
  MessageSquare,
  Quote,
  ScanFace,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import {
  ArrowNudge,
  BandGlow,
  ButtonLink,
  Card,
  CellGrid,
  HeroBackdrop,
  IconTile,
  LiveDot,
  Pill,
  Section,
  SectionHeading,
  cx,
} from '@/components/ui';
import { RotatingWord } from '@/components/rotating-word';
import { ChurnMockup, HeroComposition, PhoneMockup } from '@/components/mockups';
import { FinalCta } from '@/components/final-cta';
import { capabilityChips, homeFeatures, howItWorks } from '@/lib/features';
import { annualSavingMonths, formatRupees } from '@/lib/plans';
import { getPlans } from '@/lib/plans-source';
import { productLinks, routes } from '@/lib/site';

/**
 * Revalidate the live plan catalogue every 5 minutes.
 *
 * Set at page level (not just on the fetch) so the ISR behaviour is explicit
 * and does not depend on Next's fetch-cache heuristics — a plan edited in the
 * SCC appears here within this window without a redeploy.
 */
export const revalidate = 300;

const testimonials = [
  {
    quote:
      'This software transformed how we run our gym. We went from spreadsheets to a fully automated system in one week.',
    name: 'Rajesh Sharma',
    role: 'Fitness Club Owner, Mumbai',
  },
  {
    quote:
      'The attendance tracking and automated billing alone saved us 20 hours a week. Absolutely worth every rupee.',
    name: 'Priya Patel',
    role: 'CrossFit Studio, Bangalore',
  },
  {
    quote:
      'Managing 3 branches was a nightmare before MuscleX. Now everything is in one dashboard. Game changer.',
    name: 'Arjun Mehta',
    role: 'FitZone Chain, Delhi',
  },
];

const aiPillars = [
  {
    icon: Bot,
    title: 'AI business advisor',
    body: 'Ask your studio a question in plain language. It runs real, gym-scoped queries against your own data and answers with your numbers, not generic fitness advice.',
  },
  {
    icon: Sparkles,
    title: 'Morning briefing',
    body: 'A daily summary of what changed overnight and what needs a decision today, waiting for you before you open the doors.',
  },
  {
    icon: ScanFace,
    title: 'Churn radar',
    body: 'Members drifting away surface early, with the attendance and payment signals behind every score shown next to it.',
  },
];

export default async function HomePage() {
  const { plans } = await getPlans();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-24 pt-14 sm:pt-20 lg:pb-32">
        <HeroBackdrop />

        <div className="container-page relative">
          <div className="flex flex-col items-center text-center">
            <Link href={routes.memberApp} className="group">
              <Pill tone="accent" className="transition-colors duration-fast group-hover:bg-accent/20">
                <span className="font-semibold">NEW</span>
                <span className="text-text-2">Member super-app for iOS &amp; Android</span>
                <ArrowRight className="h-3 w-3 transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden />
              </Pill>
            </Link>

            {/* The rotating slot reserves the width of its longest word, so the
                word set is kept to a similar length — otherwise the reserved
                gap pushes "system" onto a third line. */}
            <h1 className="mt-8 max-w-[1080px] text-[38px] leading-[1.05] tracking-[-0.04em] sm:text-[56px] lg:text-[72px]">
              The complete{' '}
              <RotatingWord
                words={['operating', 'check-in', 'billing', 'marketing', 'retention']}
              />{' '}
              system
              <br className="hidden sm:block" /> for modern gyms &amp; studios.
            </h1>

            <p className="mt-7 max-w-[640px] text-lead text-text-2">
              From a single studio to a multi-branch chain: members, check-in, classes,
              billing, staff, marketing and a member mobile app, in one platform instead
              of six.
            </p>

            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href={productLinks.signup} external variant="accent" size="lg">
                Start free
                <ArrowNudge />
              </ButtonLink>
              <ButtonLink href={routes.contact} variant="glass" size="lg">
                Book a walkthrough
              </ButtonLink>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {['Free plan for up to 50 members', 'No card required', 'Cancel anytime'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-1.5 text-caption text-text-3">
                    <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                    {item}
                  </li>
                ),
              )}
            </ul>

            {/* Integration credits — what MuscleX connects to, stated as
                integrations rather than as partnership certifications. */}
            <ul className="mt-12 flex flex-wrap items-center justify-center gap-2.5">
              {[
                'Razorpay payments',
                'WhatsApp Business',
                'Facial & biometric check-in',
                'Multi-branch ready',
              ].map((item) => (
                <li key={item}>
                  <Pill>{item}</Pill>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto mt-16 max-w-[1060px] lg:mt-20">
            <HeroComposition />
            <p className="mt-14 text-center text-caption text-text-4 lg:mt-16">
              Owner dashboard and member app · sample studio data
            </p>
          </div>
        </div>
      </section>

      {/* ── Capability marquee ───────────────────────────────────────────── */}
      <section className="border-y border-hairline bg-canvas-deep py-8">
        <p className="mb-6 text-center text-caption text-text-4">
          One system, in place of the six you are running now
        </p>
        <div className="fade-x overflow-hidden">
          <ul className="flex w-max animate-marquee items-center gap-10 pr-10">
            {[...capabilityChips, ...capabilityChips].map((chip, i) => (
              <li
                key={`${chip.label}-${i}`}
                className="flex shrink-0 items-center gap-2.5 text-body-sm text-text-3"
                aria-hidden={i >= capabilityChips.length}
              >
                <chip.icon className="h-4 w-4 text-text-4" aria-hidden />
                {chip.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── AI ───────────────────────────────────────────────────────────── */}
      <Section className="relative overflow-hidden">
        <BandGlow />
        <div className="container-page relative">
          <SectionHeading
            eyebrow="ai advisor"
            title={
              <>
                Answers in seconds.
                <br />
                <span className="text-gradient">Decisions in minutes.</span>
              </>
            }
            lead="Most gym software hands you a dashboard and leaves the thinking to you. MuscleX reads your own operational data and tells you what needs attention this morning."
          />

          <div className="mt-16 grid gap-4 lg:grid-cols-3">
            {aiPillars.map((pillar) => (
              <Card key={pillar.title} hover className="flex flex-col gap-4 p-7">
                <IconTile icon={pillar.icon} tone="accent" />
                <h3 className="text-title">{pillar.title}</h3>
                <p className="text-body-sm text-text-3">{pillar.body}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <ChurnMockup />
            <p className="mt-5 text-center text-caption text-text-4">
              AI advisor · churn risk · sample studio data
            </p>
          </div>
        </div>
      </Section>

      {/* ── Check-in flywheel ────────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <div className="grid gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <p className="eyebrow">the flywheel</p>
              <h2 className="text-[34px] leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
                The check-in is the most valuable thing your gym produces.
              </h2>
              <p className="text-lead text-text-2">
                Every other gym system treats attendance as a turnstile log. MuscleX
                treats it as the signal that predicts who is about to leave, and acts on
                it before they do.
              </p>
              <div>
                <ButtonLink href={`${routes.features}#check-in`} variant="glass" size="md">
                  How check-in works
                  <ArrowNudge />
                </ButtonLink>
              </div>
            </div>

            <ol className="flex flex-col gap-3">
              {[
                {
                  step: '01',
                  title: 'Capture it, every time',
                  body: 'QR, facial recognition, biometric hardware and the front desk all write to one attendance log. There is no lane where the signal goes missing.',
                },
                {
                  step: '02',
                  title: 'Score the drift',
                  body: 'Falling visit frequency, a missed payment, an unsubscribed member, all combined into a risk score with the reasons shown beside it.',
                },
                {
                  step: '03',
                  title: 'Act automatically',
                  body: 'Automations fire on the real event: a lapsed streak, an expiring plan. The follow-up goes out over WhatsApp, email or push without anyone remembering.',
                },
              ].map((item) => (
                <li key={item.step} className="glass glass-hover flex gap-5 rounded-lg p-6">
                  <span className="text-caption font-medium tabular-nums text-accent">
                    {item.step}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-title-sm">{item.title}</h3>
                    <p className="text-body-sm text-text-3">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <SectionHeading
            eyebrow="capabilities"
            title="Everything you need to run your gym"
            lead="Not a members list with add-ons bolted onto it. The operational stack of a fitness business, built as one product."
          />

          <CellGrid className="mt-16" count={homeFeatures.length} columns={4}>
            {homeFeatures.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group flex flex-col gap-4 bg-canvas p-7 transition-colors duration-medium hover:bg-glass-1"
              >
                <IconTile icon={feature.icon} />
                <h3 className="text-title-sm">{feature.title}</h3>
                <p className="text-body-sm text-text-3">{feature.description}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-caption text-text-4 transition-colors duration-fast group-hover:text-accent">
                  Learn more
                  <ArrowRight
                    className="h-3 w-3 transition-transform duration-fast group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </CellGrid>

          <p className="mt-8 text-center text-body-sm text-text-3">
            <Link
              href={routes.features}
              className="text-text underline decoration-hairline-strong underline-offset-4 transition-colors duration-fast hover:decoration-accent"
            >
              See all capabilities
            </Link>{' '}
            across members, check-in, classes, finance, staff, marketing and AI.
          </p>
        </div>
      </Section>

      {/* ── Member app ───────────────────────────────────────────────────── */}
      <Section tone="deep" className="relative overflow-hidden">
        <BandGlow />
        <div className="container-page relative">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col gap-6">
              <p className="eyebrow">member app</p>
              <h2 className="text-[34px] leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
                Give members a reason to open your gym{' '}
                <span className="text-gradient">every day.</span>
              </h2>
              <p className="text-lead text-text-2">
                Most gym software gives members a payment link. MuscleX gives them a
                super-app, so your studio becomes a daily habit rather than a monthly
                debit.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  'Book classes and check in by QR from their phone',
                  'Assigned workouts and an exercise library',
                  'Meal, water and body-metric logging',
                  'Direct chat with their trainer',
                  'Streaks, progress and a studio community feed',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-body text-text-2">
                    <Check className="mt-1.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <div>
                <ButtonLink href={routes.memberApp} variant="glass" size="md">
                  Explore the member app
                  <ArrowNudge />
                </ButtonLink>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </Section>

      {/* ── WhatsApp / automations ───────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <div className="glass relative overflow-hidden rounded-2xl p-8 sm:p-12 lg:p-16">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="flex flex-col gap-6">
                <IconTile icon={MessageSquare} tone="accent" />
                <h2 className="text-[30px] leading-[1.1] tracking-[-0.03em] sm:text-display-4">
                  Reach members where they actually reply.
                </h2>
                <p className="text-lead text-text-2">
                  WhatsApp Business, email and push, triggered by what members actually
                  do, not by a reminder someone has to remember to send.
                </p>
                <div>
                  <ButtonLink href={`${routes.features}#growth`} variant="glass" size="md">
                    Marketing &amp; automations
                    <ArrowNudge />
                  </ButtonLink>
                </div>
              </div>

              {/* Automation rule illustration. */}
              <div className="flex flex-col gap-3">
                {[
                  { when: 'No check-in for 14 days', then: 'Send a WhatsApp win-back', tone: 'accent' },
                  { when: 'Membership expires in 7 days', then: 'Email renewal + payment link' },
                  { when: 'Payment fails on retry', then: 'Notify the front desk' },
                  { when: 'First class booked', then: 'Push a welcome from the coach' },
                ].map((rule) => (
                  <div
                    key={rule.when}
                    className="glass-2 flex flex-col gap-2 rounded-md p-4 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="text-micro font-medium uppercase tracking-[0.12em] text-text-4">
                        When
                      </span>
                      <span className="truncate text-body-sm text-text-2">{rule.when}</span>
                    </div>
                    <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-text-4 sm:block" aria-hidden />
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="text-micro font-medium uppercase tracking-[0.12em] text-text-4">
                        Then
                      </span>
                      <span
                        className={cx(
                          'truncate text-body-sm',
                          rule.tone === 'accent' ? 'text-accent' : 'text-text-2',
                        )}
                      >
                        {rule.then}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pl-1 pt-1">
                  <LiveDot />
                  <span className="text-caption text-text-4">Rules run continuously</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Getting started ──────────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <SectionHeading
            eyebrow="getting started"
            title="Live in an afternoon, not a quarter."
            lead="Guided onboarding takes you from an empty account to a running studio without an implementation consultant."
          />

          <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {howItWorks.map((step, i) => (
              <li key={step.title} className="glass glass-hover flex flex-col gap-4 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <IconTile icon={step.icon} />
                  <span className="text-caption tabular-nums text-text-4">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-title-sm">{step.title}</h3>
                <p className="text-body-sm text-text-3">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ── Pricing preview ──────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <SectionHeading
            eyebrow="pricing"
            title="Priced per studio, not per member."
            lead="Start free and upgrade when your member count says so. Annual billing takes two months off."
          />

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const months = annualSavingMonths(plan);
              return (
                <div
                  key={plan.id}
                  className={cx(
                    'relative flex flex-col gap-5 rounded-lg p-7',
                    plan.featured
                      ? 'glass glow-accent'
                      : 'glass glass-hover',
                  )}
                >
                  {plan.featured ? (
                    <span className="absolute -top-3 left-7 rounded-pill bg-accent px-3 py-1 text-micro font-semibold uppercase tracking-[0.1em] text-accent-ink">
                      Popular
                    </span>
                  ) : null}

                  <h3 className="text-title">{plan.name}</h3>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                      {formatRupees(plan.monthlyPrice)}
                    </span>
                    <span className="text-body-sm text-text-4">/month</span>
                  </div>

                  <p className="text-body-sm text-text-3">{plan.description}</p>

                  <ul className="flex flex-1 flex-col gap-2.5 border-t border-hairline pt-5">
                    {plan.highlights.slice(0, 4).map((h) => (
                      <li key={h} className="flex items-start gap-2.5 text-body-sm text-text-3">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                        {h}
                      </li>
                    ))}
                  </ul>

                  {months ? (
                    <p className="text-caption text-text-4">{months} months free on annual</p>
                  ) : null}

                  <ButtonLink
                    href={plan.id === 'enterprise' ? routes.contact : productLinks.signup}
                    external={plan.id !== 'enterprise'}
                    variant={plan.featured ? 'accent' : 'glass'}
                    size="md"
                    className="w-full"
                  >
                    {plan.cta}
                  </ButtonLink>
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link
              href={routes.pricing}
              className="inline-flex items-center gap-1.5 text-body-sm text-text-2 transition-colors duration-fast hover:text-text"
            >
              Compare all 16 features plan by plan
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </Section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <SectionHeading
            eyebrow="customers"
            title="Loved by gym owners everywhere."
            lead="Hear from fitness professionals who transformed their business."
          />

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} hover className="flex flex-col gap-5 p-7">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5" aria-label="5 out of 5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-accent-amber text-accent-amber" aria-hidden />
                    ))}
                  </div>
                  <Quote className="h-5 w-5 text-text-4" aria-hidden />
                </div>
                <blockquote className="flex-1 text-body text-text-2">{t.quote}</blockquote>
                <div className="flex items-center gap-3 border-t border-hairline pt-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-glass-2 text-body-sm font-medium">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-body-sm font-medium">{t.name}</p>
                    <p className="text-caption text-text-4">{t.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Pill icon={Zap}>500+ gyms already onboard</Pill>
          </div>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
