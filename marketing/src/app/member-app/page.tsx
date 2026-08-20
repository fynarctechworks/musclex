import type { Metadata } from 'next';
import {
  Activity,
  Apple,
  BellRing,
  CalendarCheck,
  Check,
  Dumbbell,
  Gift,
  HeartPulse,
  IdCard,
  MapPin,
  MessageCircle,
  Moon,
  QrCode,
  Users,
} from 'lucide-react';
import {
  ArrowNudge,
  BandGlow,
  ButtonLink,
  CellGrid,
  HeroBackdrop,
  IconTile,
  Pill,
  Section,
  SectionHeading,
} from '@/components/ui';
import { PhoneMockup } from '@/components/mockups';
import { FinalCta } from '@/components/final-cta';
import { productLinks, routes } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Member app',
  description:
    'The MuscleX member mobile app: workouts, exercise library, nutrition logging, class booking, QR check-in, trainer chat, progress and health tracking, rewards and a studio community feed.',
  alternates: { canonical: routes.memberApp },
};

/**
 * Content maps to what the member app actually ships — the route set under
 * `member-app/app/` and the Member BFF in `backend/src/member/`.
 */
const appFeatures = [
  {
    icon: Dumbbell,
    title: 'Workouts and exercises',
    body: 'Assigned programmes plus a searchable exercise library with per-exercise detail, so members know what to do on the days you are not standing next to them.',
  },
  {
    icon: Apple,
    title: 'Nutrition logging',
    body: 'Daily meals and water tracked against goals. The habit that keeps members engaged between visits is the one that happens outside the gym.',
  },
  {
    icon: CalendarCheck,
    title: 'Class booking',
    body: 'Browse the schedule, book a spot, join a waitlist and get promoted automatically when a place opens up.',
  },
  {
    icon: QrCode,
    title: 'Check in at the door',
    body: 'A QR scan from the phone, plus a digital member ID for the front desk. Every scan feeds the same attendance log your dashboards read.',
  },
  {
    icon: MessageCircle,
    title: 'Trainer chat',
    body: 'A direct line to their coach inside the app, so the relationship lives in your product rather than in a personal WhatsApp thread.',
  },
  {
    icon: Activity,
    title: 'Progress tracking',
    body: 'Body metrics, statistics and activity history in one view, so improvement is visible rather than remembered.',
  },
  {
    icon: HeartPulse,
    title: 'Health data',
    body: 'Heart and activity metrics alongside training, giving members the full picture of what their effort is doing.',
  },
  {
    icon: Moon,
    title: 'Sleep and mindfulness',
    body: 'Recovery is part of training. Sleep tracking and mindfulness sessions round out the programme.',
  },
  {
    icon: Users,
    title: 'Community feed',
    body: 'A studio feed that turns a membership into belonging to something, the strongest retention mechanic there is.',
  },
  {
    icon: Gift,
    title: 'Rewards and referrals',
    body: 'Streaks and rewards for the behaviour you want, and a referral flow that turns happy members into new ones.',
  },
  {
    icon: IdCard,
    title: 'Membership and payments',
    body: 'Members see their plan, expiry and dues, and can settle a renewal through a hosted checkout on their phone.',
  },
  {
    icon: MapPin,
    title: 'Locations',
    body: 'For chains: find any branch, see its schedule and check in wherever they are training that day.',
  },
];

const onboardingSteps = [
  {
    title: 'Sign in with a phone number',
    body: 'Phone plus OTP. No password to forget, no email that never arrives.',
  },
  {
    title: 'Pick their gym',
    body: 'Members choose your studio from the directory, and land inside your branding and your schedule.',
  },
  {
    title: 'Set a goal',
    body: 'A short goal-setting step so the first screen they see is already about them.',
  },
];

export default function MemberAppPage() {
  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
        <HeroBackdrop />
        <div className="container-page relative">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col gap-6">
              <Pill tone="accent">Member mobile app</Pill>
              <h1 className="text-[40px] leading-[1.04] tracking-[-0.04em] sm:text-[56px]">
                Your gym, in your members&rsquo;{' '}
                <span className="text-gradient">pockets.</span>
              </h1>
              <p className="max-w-[580px] text-lead text-text-2">
                Most gym software gives members a payment link. MuscleX gives them a
                super-app with training, nutrition, booking, chat, progress and community,
                so your studio becomes something they open daily instead of monthly.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={productLinks.signup} external variant="accent" size="lg">
                  Start free
                  <ArrowNudge />
                </ButtonLink>
                <ButtonLink href={routes.contact} variant="glass" size="lg">
                  Request a walkthrough
                </ButtonLink>
              </div>
              <p className="text-caption text-text-4">
                iOS and Android · included with every paid plan
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Why it matters ───────────────────────────────────────────────── */}
      <Section tone="deep" className="relative overflow-hidden">
        <BandGlow />
        <div className="container-page relative">
          <SectionHeading
            align="left"
            eyebrow="retention"
            title="Engagement between visits is what stops churn."
            lead="A member who only touches your business when a payment is due has nothing anchoring them when a cheaper gym opens down the road. The app is the anchor."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'A daily surface',
                body: 'Logging a meal, checking a workout, seeing a streak. Small daily touches that keep your studio present in a member’s routine.',
              },
              {
                title: 'A visible relationship',
                body: 'Trainer chat and assigned programmes make the coaching relationship concrete, which is exactly what members say they are paying for.',
              },
              {
                title: 'A better signal for you',
                body: 'Every booking, check-in and log is data your dashboards and churn scoring read. The app makes your analytics sharper, not just your members happier.',
              },
            ].map((item) => (
              <div key={item.title} className="glass glass-hover flex flex-col gap-3 rounded-lg p-7">
                <h3 className="text-title">{item.title}</h3>
                <p className="text-body-sm text-text-3">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <SectionHeading
            eyebrow="what members get"
            title="Everything a member needs, in one app."
          />

          <CellGrid className="mt-16" count={appFeatures.length} columns={3}>
            {appFeatures.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-4 bg-canvas p-7">
                <IconTile icon={feature.icon} />
                <h3 className="text-title-sm">{feature.title}</h3>
                <p className="text-body-sm text-text-3">{feature.body}</p>
              </div>
            ))}
          </CellGrid>
        </div>
      </Section>

      {/* ── Onboarding ───────────────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionHeading
              align="left"
              eyebrow="member onboarding"
              title="Three steps from download to first check-in."
              lead="Friction at sign-up is where member apps die. This one asks for a phone number and gets out of the way."
            />

            <ol className="flex flex-col gap-3">
              {onboardingSteps.map((step, i) => (
                <li key={step.title} className="glass flex gap-5 rounded-lg p-6">
                  <span className="text-caption font-medium tabular-nums text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-title-sm">{step.title}</h3>
                    <p className="text-body-sm text-text-3">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <div className="glass rounded-2xl p-8 sm:p-12 lg:p-16">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="flex flex-col gap-5">
                <IconTile icon={BellRing} tone="accent" />
                <h2 className="text-[30px] leading-[1.1] tracking-[-0.03em] sm:text-display-4">
                  The app is also your best delivery channel.
                </h2>
                <p className="text-lead text-text-2">
                  Push notifications reach members without a template approval queue or a
                  per-message cost. Your automations can reach them there, over WhatsApp
                  or over email, whichever the member actually responds to.
                </p>
              </div>
              <ul className="flex flex-col gap-3.5">
                {[
                  'Class reminders and waitlist promotions',
                  'Renewal and payment nudges',
                  'Streak and milestone celebrations',
                  'Trainer messages and programme updates',
                  'Studio announcements to a segment or everyone',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-body text-text-2">
                    <Check className="mt-1.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <FinalCta
        title="Put your gym in your members’ pockets."
        lead="The member app ships with every paid plan. Set up your studio and invite your first members today."
      />
    </>
  );
}
