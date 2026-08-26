import type { Metadata } from 'next';
import {
  ArrowRight,
  Building2,
  KeyRound,
  LifeBuoy,
  Mail,
  ScanLine,
  Smartphone,
} from 'lucide-react';
import {
  ArrowNudge,
  ButtonLink,
  Card,
  HeroBackdrop,
  IconTile,
  Section,
  SectionHeading,
} from '@/components/ui';
import { contactEmail, productLinks, routes, supportEmail } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with MuscleX: the gym admin app, the MuscleX Staff app and the member app. Common answers, and how to reach a human.',
  alternates: { canonical: routes.support },
  robots: { index: true, follow: true },
};

/**
 * The App Store requires a support URL, and it has to be a PAGE — a `mailto:`
 * link fails review, which is exactly what the footer's "Support" entry used
 * to be.
 *
 * It is also the page a staff member lands on from a gym floor with a problem
 * in front of them, so the answers come first and the contact form is at the
 * bottom. A support page whose only content is an email address wastes the
 * trip.
 */

const faqs = [
  {
    icon: KeyRound,
    q: 'I cannot sign in to the staff app.',
    a: 'Staff accounts are created by your gym, not by you. Ask an owner or manager to check your account under Settings → Staff, and to confirm which branch you are assigned to. If your password is right but sign-in is refused five times, the account locks for fifteen minutes as a security measure — wait it out rather than retrying.',
  },
  {
    icon: Smartphone,
    q: 'It is asking for a two-factor code and I have lost my phone.',
    a: 'Use one of the backup codes you saved when you switched two-factor on. Each works once. If you have none left, an owner at your gym can reset two-factor for your account from the web app under Settings → Security.',
  },
  {
    icon: ScanLine,
    q: 'The QR scanner will not read a member’s code.',
    a: 'Check that the app has camera permission in your phone’s Settings. If the code still will not read — a cracked screen and low light both defeat it — search the member by name or phone number on the same screen and check them in that way. Nothing is lost by doing it manually.',
  },
  {
    icon: Building2,
    q: 'I work at more than one location and I am seeing the wrong one.',
    a: 'The app signs you in to one gym at a time. Sign out and back in to pick a different one, and use the branch selector at the top of the dashboard to narrow to a single branch within it.',
  },
  {
    icon: LifeBuoy,
    q: 'The app says I am offline but my phone has signal.',
    a: 'Gym Wi-Fi is often the culprit — a network that is connected but not passing traffic. The app keeps working from cached data and queues anything you record, including check-ins, then syncs when the connection returns. You can carry on; nothing is dropped.',
  },
  {
    icon: Mail,
    q: 'A member’s details or payment look wrong.',
    a: 'Anything about a member’s record, membership or dues is held by the gym, and staff there can correct it. If you are a member, speak to your gym first — they control the record. We can help them, but we do not change a gym’s data on our own.',
  },
];

export default function SupportPage() {
  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-16 pt-16 sm:pt-24">
        <HeroBackdrop />
        <div className="container-page relative">
          <div className="flex max-w-2xl flex-col gap-6">
            <p className="eyebrow">support</p>
            <h1 className="text-[40px] leading-[1.04] tracking-[-0.04em] sm:text-[52px]">
              Something not <span className="text-gradient">behaving?</span>
            </h1>
            <p className="text-lead text-text-2">
              Most of what comes in has one of the answers below. If yours is not here,
              email us and include your gym&rsquo;s name — it is the fastest way for us to
              find your account.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href={`mailto:${supportEmail}?subject=Support%20request`}
                external
                size="md"
              >
                Email support
                <ArrowNudge />
              </ButtonLink>
              <ButtonLink href={routes.contact} variant="glass" size="md">
                Other ways to reach us
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── Common answers ───────────────────────────────────────────────── */}
      <Section tone="deep">
        <div className="container-page">
          <SectionHeading
            align="left"
            eyebrow="common questions"
            title="Answers to what we are asked most."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {faqs.map((f) => (
              <Card key={f.q} className="flex flex-col gap-4 p-6">
                <IconTile icon={f.icon} />
                <div className="flex flex-col gap-2">
                  <h3 className="text-[17px] tracking-[-0.02em]">{f.q}</h3>
                  <p className="text-sm leading-relaxed text-text-2">{f.a}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Reaching a person ────────────────────────────────────────────── */}
      <Section>
        <div className="container-page">
          <div className="glass flex flex-col gap-6 rounded-2xl p-8 sm:p-12">
            <SectionHeading
              align="left"
              eyebrow="talk to us"
              title="Still stuck?"
              lead={
                <>
                  Email{' '}
                  <a
                    href={`mailto:${supportEmail}?subject=Support%20request`}
                    className="text-text-1 underline underline-offset-4"
                  >
                    {contactEmail}
                  </a>{' '}
                  and tell us your gym&rsquo;s name, what you were doing, and what happened
                  instead. Screenshots help more than anything else.
                </>
              }
            />
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={routes.contact} size="md">
                Contact us
                <ArrowNudge />
              </ButtonLink>
              <ButtonLink href={productLinks.login} external variant="glass" size="md">
                Log in to the web app
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
            <p className="text-sm text-text-3">
              If you are a gym <strong>member</strong> rather than staff, your gym is the
              fastest route — they hold your membership, your payments and your check-in
              history, and they can change them. We cannot.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
