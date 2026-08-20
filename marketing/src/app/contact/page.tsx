import type { Metadata } from 'next';
import { ArrowRight, LifeBuoy, Mail, Rocket, ShieldAlert } from 'lucide-react';
import {
  ArrowNudge,
  ButtonLink,
  CellGrid,
  HeroBackdrop,
  IconTile,
  Section,
  SectionHeading,
} from '@/components/ui';
import { ContactForm } from './contact-form';
import {
  contactEmail,
  productLinks,
  routes,
  salesEmail,
  securityEmail,
  supportEmail,
} from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to the MuscleX team about your studio: product questions, pricing, migrating from another system, or multi-branch and Enterprise requirements.',
  alternates: { canonical: routes.contact },
};

/**
 * All four channels reach the same inbox, so the cards must not each print the
 * address, since four identical lines reads like a bug. Instead each card prefills a
 * subject so the mail arrives already sorted, and the address itself is shown
 * once for the whole section.
 */
const channels = [
  {
    icon: Rocket,
    title: 'Sales and demos',
    body: 'Multi-branch requirements, migration from another system, or a walkthrough with your own numbers in front of you.',
    email: salesEmail,
    subject: 'Sales enquiry',
  },
  {
    icon: LifeBuoy,
    title: 'Support',
    body: 'Already running on MuscleX and something is not behaving. Include your studio name so we can find you quickly.',
    email: supportEmail,
    subject: 'Support request',
  },
  {
    icon: ShieldAlert,
    title: 'Security',
    body: 'Found a vulnerability, or need to ask about how we handle a specific class of data. This one goes straight to the team.',
    email: securityEmail,
    subject: 'Security report',
  },
  {
    icon: Mail,
    title: 'Everything else',
    body: 'Partnerships, press, or a question that does not fit anywhere above.',
    email: contactEmail,
    subject: 'General enquiry',
  },
];

export default function ContactPage() {
  return (
    <>
      {/* ── Header + form ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
        <HeroBackdrop />
        <div className="container-page relative">
          <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="flex flex-col gap-6">
              <p className="eyebrow">contact</p>
              <h1 className="text-[40px] leading-[1.04] tracking-[-0.04em] sm:text-[52px]">
                Tell us about your <span className="text-gradient">studio.</span>
              </h1>
              <p className="text-lead text-text-2">
                The more you tell us about how you run things today, the more useful our
                answer will be. If you would rather just try it, the free plan does not
                need us at all.
              </p>
              <div>
                <ButtonLink href={productLinks.signup} external variant="glass" size="md">
                  Skip ahead and start free
                  <ArrowNudge />
                </ButtonLink>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 sm:p-9">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Direct channels ──────────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <SectionHeading
            align="left"
            eyebrow="direct"
            title="Or email us straight away."
            lead={
              <>
                Everything reaches{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-text underline decoration-hairline-strong underline-offset-4 transition-colors duration-fast hover:decoration-accent"
                >
                  {contactEmail}
                </a>
                . Pick the closest match below and we will open your mail app with the
                subject already filled in.
              </>
            }
          />

          <CellGrid className="mt-14" count={channels.length} columns={2} cellClassName="bg-canvas-deep">
            {channels.map((channel) => (
              <a
                key={channel.title}
                href={`mailto:${channel.email}?subject=${encodeURIComponent(
                  `MuscleX ${channel.subject}`,
                )}`}
                className="group flex flex-col gap-4 bg-canvas-deep p-7 transition-colors duration-medium hover:bg-glass-1"
              >
                <IconTile icon={channel.icon} />
                <h2 className="text-title-sm">{channel.title}</h2>
                <p className="text-body-sm text-text-3">{channel.body}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-caption text-accent">
                  Write to us
                  <ArrowRight
                    className="h-3 w-3 transition-transform duration-fast group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </a>
            ))}
          </CellGrid>
        </div>
      </Section>

      {/* ── Existing customers ───────────────────────────────────────────── */}
      <Section className="!py-20">
        <div className="container-page">
          <div className="glass flex flex-col items-start justify-between gap-6 rounded-2xl p-8 sm:flex-row sm:items-center sm:p-12">
            <div className="flex flex-col gap-2">
              <h2 className="text-title">Already a MuscleX studio?</h2>
              <p className="text-body text-text-3">
                Sign in to your workspace. Support is also available from inside the app.
              </p>
            </div>
            <ButtonLink
              href={productLinks.login}
              external
              variant="accent"
              size="lg"
              className="shrink-0"
            >
              Log in
              <ArrowNudge />
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
