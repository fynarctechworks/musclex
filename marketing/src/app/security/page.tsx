import type { Metadata } from 'next';
import {
  Building2,
  ClipboardList,
  Fingerprint,
  KeyRound,
  Lock,
  ScrollText,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Webhook,
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
import { FinalCta } from '@/components/final-cta';
import { productLinks, routes, securityEmail } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How MuscleX protects gym and member data: per-studio data separation, gym-scoped access on every request, two-factor authentication, login lockout, secret-field stripping, validated inputs and audit logs.',
  alternates: { canonical: routes.security },
};

/**
 * Every claim on this page is backed by code in this repo. Nothing here
 * asserts a certification, audit or compliance programme that does not exist —
 * if you add one, add the evidence with it.
 */

const isolationPoints = [
  {
    icon: Building2,
    title: 'Per-studio data separation',
    body: 'Each gym is a tenant with its own data. Tenant records live in per-studio database schemas rather than pooled into one shared table space.',
  },
  {
    icon: ShieldCheck,
    title: 'Gym scoping on every request',
    body: 'The identity of the studio comes from the signed token on the request, and the platform applies that scope to data access. It is not something a page can forget to pass.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Branch-level scoping',
    body: 'Within a studio, branch managers are scoped to their branch. The restriction is applied server-side, not by hiding buttons in the interface.',
  },
];

const accessPoints = [
  {
    icon: KeyRound,
    title: 'Authenticated by default',
    body: 'Every API route requires a signed bearer token. Only sign-in and the health check are reachable without one.',
  },
  {
    icon: Fingerprint,
    title: 'Two-factor authentication',
    body: 'Staff accounts can require a second factor at sign-in, with a supported recovery path for lost devices.',
  },
  {
    icon: Lock,
    title: 'Login lockout',
    body: 'Five failed attempts lock the account for fifteen minutes. The lock is stored, not held in memory, so restarting a server does not reset an attacker’s counter.',
  },
  {
    icon: UserCheck,
    title: 'Sessions and devices',
    body: 'Active sessions and signed-in devices are visible and revocable, with a login history for every account.',
  },
  {
    icon: ClipboardList,
    title: 'Roles and permissions',
    body: 'Build the roles your organisation actually uses and grant only the permissions each one needs. Available from the Pro plan.',
  },
  {
    icon: ScrollText,
    title: 'Audit logs',
    body: 'A record of who changed what, available from the Starter plan upward.',
  },
];

const dataPoints = [
  {
    icon: ServerCog,
    title: 'Sensitive fields never leave the server',
    body: 'Face descriptors, stored payment tokens, password hashes, two-factor secrets and salary fields are stripped from API responses centrally, so no individual endpoint can leak them by accident.',
  },
  {
    icon: Lock,
    title: 'Private file storage',
    body: 'Member documents and uploads are held in private buckets and reached through signed URLs rather than public links. Uploads are validated server-side for type, size and extension.',
  },
  {
    icon: Webhook,
    title: 'Verified payment webhooks',
    body: 'Inbound payment webhooks are signature-checked with a timing-safe comparison before anything is processed. Card details are handled by the payment gateway and never stored by MuscleX.',
  },
  {
    icon: ShieldCheck,
    title: 'Validated inputs',
    body: 'Every endpoint validates its payload against a declared schema and rejects unrecognised fields outright, rather than trusting whatever arrives.',
  },
];

export default function SecurityPage() {
  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
        <HeroBackdrop />
        <div className="container-page relative">
          <div className="flex max-w-[820px] flex-col gap-6">
            <Pill tone="accent" icon={ShieldCheck}>
              Security
            </Pill>
            <h1 className="text-[40px] leading-[1.04] tracking-[-0.04em] sm:text-[56px]">
              Your members&rsquo; data is the most sensitive thing you hold.
            </h1>
            <p className="max-w-[640px] text-lead text-text-2">
              Names, phone numbers, payment records, health details and, if you use
              facial check-in, biometric data. Here is specifically how MuscleX handles
              it, and what we do not claim.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={`mailto:${securityEmail}`} variant="accent" size="lg">
                Contact the security team
                <ArrowNudge />
              </ButtonLink>
              <ButtonLink href={routes.contact} variant="glass" size="lg">
                Ask a question
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tenant isolation ─────────────────────────────────────────────── */}
      <Section tone="deep" className="relative overflow-hidden">
        <BandGlow />
        <div className="container-page relative">
          <SectionHeading
            align="left"
            eyebrow="isolation"
            title={
              <>
                One gym must never see{' '}
                <span className="text-gradient">another gym&rsquo;s data.</span>
              </>
            }
            lead="MuscleX is multi-tenant: many studios run on one platform. Keeping those studios separate is treated as the system's most important property, not as a configuration setting."
          />

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {isolationPoints.map((point) => (
              <div key={point.title} className="glass glass-hover flex flex-col gap-4 rounded-lg p-7">
                <IconTile icon={point.icon} tone="accent" />
                <h3 className="text-title">{point.title}</h3>
                <p className="text-body-sm text-text-3">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Access control ───────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <SectionHeading
            align="left"
            eyebrow="access"
            title="Who gets in, and what they can reach."
            lead="Staff accounts are the realistic attack surface in gym software: shared, high-turnover and used on shared machines at a front desk."
          />

          <CellGrid className="mt-14" count={accessPoints.length} columns={3}>
            {accessPoints.map((point) => (
              <div key={point.title} className="flex flex-col gap-4 bg-canvas p-7">
                <IconTile icon={point.icon} />
                <h3 className="text-title-sm">{point.title}</h3>
                <p className="text-body-sm text-text-3">{point.body}</p>
              </div>
            ))}
          </CellGrid>
        </div>
      </Section>

      {/* ── Data handling ────────────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <SectionHeading
            align="left"
            eyebrow="data handling"
            title="What the system refuses to hand out."
            lead="The safest way to avoid leaking a sensitive field is to make it structurally impossible for a route to return it."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {dataPoints.map((point) => (
              <div key={point.title} className="glass glass-hover flex flex-col gap-4 rounded-lg p-7">
                <IconTile icon={point.icon} />
                <h3 className="text-title-sm">{point.title}</h3>
                <p className="text-body-sm text-text-3">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Biometrics ───────────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <div className="glass grid gap-12 rounded-2xl p-8 sm:p-12 lg:grid-cols-[0.9fr_1.1fr] lg:p-16">
            <div className="flex flex-col gap-5">
              <IconTile icon={Fingerprint} tone="accent" />
              <h2 className="text-[30px] leading-[1.1] tracking-[-0.03em] sm:text-display-4">
                Facial check-in is optional, and treated as biometric data.
              </h2>
              <p className="text-lead text-text-2">
                Face recognition is a convenience feature, not a requirement. If you
                choose not to enable it, no face data is ever collected.
              </p>
            </div>
            <ul className="flex flex-col gap-4">
              {[
                'Facial check-in is off unless you turn it on, per studio.',
                'Face descriptors are stripped from every API response, so they are never returned to a client.',
                'Members who prefer not to enrol can use QR, a device or the front desk instead, with no loss of access.',
                'Biometric data is regulated differently across jurisdictions. Check your local obligations before enabling it, and tell your members what you are collecting.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-body text-text-2">
                  <ShieldCheck className="mt-1.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── What we don't claim ──────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <div className="glass mx-auto max-w-[820px] rounded-2xl p-8 sm:p-12">
            <p className="eyebrow">honesty</p>
            <h2 className="mt-4 text-[30px] leading-[1.1] tracking-[-0.03em] sm:text-display-4">
              What we do not claim.
            </h2>
            <div className="mt-6 flex flex-col gap-4 text-body text-text-2">
              <p>
                Plenty of software in this category advertises certifications it has not
                earned. We would rather be specific about what exists today.
              </p>
              <p>
                MuscleX does not currently hold a SOC 2, ISO 27001 or equivalent
                third-party audit, and this page should not be read as a compliance
                certification of any kind. The controls described above are the controls
                that are actually implemented in the product.
              </p>
              <p>
                Security work is continuous. If you have found something, or your
                organisation needs a specific control before it can adopt MuscleX, we
                would genuinely rather hear from you than not.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={`mailto:${securityEmail}`} variant="accent" size="md">
                Report a vulnerability
              </ButtonLink>
              <ButtonLink href={productLinks.signup} external variant="glass" size="md">
                Start free
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      <FinalCta
        title="Run your studio on a system that takes this seriously."
        lead="Start on the free plan and see how MuscleX handles your data before you move anything important onto it."
      />
    </>
  );
}
