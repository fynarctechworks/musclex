import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  ArrowNudge,
  BandGlow,
  ButtonLink,
  CellGrid,
  HeroBackdrop,
  IconTile,
  Section,
  SectionHeading,
} from '@/components/ui';
import { CheckInMockup, DashboardMockup } from '@/components/mockups';
import { FinalCta } from '@/components/final-cta';
import { featureGroups } from '@/lib/features';
import { productLinks, routes } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Members and memberships, four-way check-in, class scheduling, payments and invoicing, staff and permissions, marketing automations, an AI business advisor, dashboards, multi-branch and a member mobile app.',
  alternates: { canonical: routes.features },
};

export default function FeaturesPage() {
  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
        <HeroBackdrop />
        <div className="container-page relative">
          <div className="flex max-w-[820px] flex-col gap-6">
            <p className="eyebrow">features</p>
            <h1 className="text-[40px] leading-[1.04] tracking-[-0.04em] sm:text-[58px] lg:text-display-2">
              Every part of the operation, built as{' '}
              <span className="text-gradient">one product.</span>
            </h1>
            <p className="max-w-[620px] text-lead text-text-2">
              MuscleX is not a members list with add-ons bolted on. Below is what
              actually ships today, grouped the way a gym is actually run.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={productLinks.signup} external variant="accent" size="lg">
                Start free
                <ArrowNudge />
              </ButtonLink>
              <ButtonLink href={routes.pricing} variant="glass" size="lg">
                See pricing
              </ButtonLink>
            </div>
          </div>

          {/* Ten groups is too many to scroll blindly. */}
          <nav aria-label="Feature sections" className="mt-14">
            <ul className="flex flex-wrap gap-2">
              {featureGroups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`#${group.id}`}
                    className="glass glass-hover inline-flex rounded-pill px-4 py-2 text-body-sm text-text-2 transition-colors duration-fast hover:text-text"
                  >
                    {group.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* ── Feature groups ───────────────────────────────────────────────── */}
      {featureGroups.map((group, index) => {
        // Two groups carry a supporting visual; the rest stay type-only so the
        // page keeps a readable rhythm rather than a mockup every screen.
        const visual =
          group.id === 'check-in' ? (
            <CheckInMockup />
          ) : group.id === 'analytics' ? (
            <DashboardMockup />
          ) : null;

        return (
          <Section
            key={group.id}
            id={group.id}
            tone={index % 2 === 0 ? 'deep' : 'canvas'}
            className="relative overflow-hidden !py-20 sm:!py-24"
          >
            {index % 2 === 0 ? <BandGlow className="opacity-60" /> : null}
            <div className="container-page relative">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3.5">
                  <IconTile icon={group.icon} tone="accent" />
                  <p className="eyebrow">{group.eyebrow}</p>
                </div>
                <h2 className="max-w-[780px] text-[32px] leading-[1.08] tracking-[-0.035em] sm:text-display-4">
                  {group.title}
                </h2>
                <p className="max-w-[740px] text-lead text-text-2">{group.summary}</p>
              </div>

              <CellGrid
                className="mt-12"
                count={group.items.length}
                columns={3}
                // Fillers must match the cells, which follow the band tone —
                // otherwise a short last row shows a mismatched patch.
                cellClassName={index % 2 === 0 ? 'bg-canvas-deep' : 'bg-canvas'}
              >
                {group.items.map((item) => (
                  <div
                    key={item.title}
                    className={`flex flex-col gap-2.5 p-7 ${
                      index % 2 === 0 ? 'bg-canvas-deep' : 'bg-canvas'
                    }`}
                  >
                    <h3 className="text-title-sm">{item.title}</h3>
                    <p className="text-body-sm text-text-3">{item.description}</p>
                  </div>
                ))}
              </CellGrid>

              {visual ? (
                <div className="mt-12">
                  {visual}
                  <p className="mt-5 text-caption text-text-4">Sample studio data</p>
                </div>
              ) : null}

              {group.id === 'member-app' ? (
                <div className="mt-8">
                  <ButtonLink href={routes.memberApp} variant="glass" size="md">
                    See the member app in detail
                    <ArrowNudge />
                  </ButtonLink>
                </div>
              ) : null}
            </div>
          </Section>
        );
      })}

      {/* ── Plan availability ────────────────────────────────────────────── */}
      <Section className="!py-20">
        <div className="container-page">
          <div className="glass rounded-2xl p-8 sm:p-12">
            <SectionHeading
              align="left"
              eyebrow="availability"
              title="Not every capability is on every plan."
              lead="Class scheduling, online payments and WhatsApp start at Starter. Multi-branch, marketing campaigns, the AI advisor, custom roles and API access start at Pro. The comparison table lists all sixteen, line by line."
            />
            <div className="mt-8">
              <ButtonLink href={routes.pricing} variant="accent" size="md">
                Compare plans
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
