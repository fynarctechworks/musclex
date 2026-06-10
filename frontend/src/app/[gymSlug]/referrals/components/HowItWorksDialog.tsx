'use client';

import {
  Info,
  Share2,
  CreditCard,
  CalendarCheck,
  Gift,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Plain-English rules for gym owners. The content here MUST match what the
 * backend actually does — if the policy changes, update this dialog too.
 * Reference: referrals.service.ts handleSubscriptionActivated / handleTrialCompleted,
 * reward-processor.service.ts applySubscriptionExtension / reverseReward.
 */
export function HowItWorksDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Info className="h-4 w-4 text-primary" />
            How the Referral Program Works
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Everything you need to know about earning subscription days by
            referring other gyms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* ── How you earn ─────────────────────────────────────── */}
          <Section
            icon={Gift}
            title="How you earn rewards"
            tone="primary"
          >
            <Step
              n={1}
              icon={Share2}
              label="Share your code"
              text="Send your 6-character referral code to another gym owner."
            />
            <Step
              n={2}
              icon={CreditCard}
              label="They sign up & start a trial"
              text="They enter your code during onboarding and pick a paid plan. At this stage you have NOT earned anything yet — they're still in their free trial."
            />
            <Step
              n={3}
              icon={CalendarCheck}
              label="They complete their trial"
              text="Once their trial period ends and they're still on a paid plan, you earn the reward automatically. The days are added to your subscription."
            />
          </Section>

          {/* ── Why we wait ─────────────────────────────────────── */}
          <Section
            icon={ShieldCheck}
            title="Why we wait for the trial to end"
            tone="muted"
          >
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Crediting the reward immediately would let bad actors create fake
              gym accounts, click a plan, and cancel during trial for a full
              refund — leaving you with bonus days they never paid for. Waiting
              until trial completes means the referred gym is a real, paying
              customer before you get rewarded.
            </p>
          </Section>

          {/* ── If the referred gym cancels ──────────────────────── */}
          <Section
            icon={XCircle}
            title="What if the referred gym cancels?"
            tone="warning"
          >
            <Rule
              label="During trial"
              text="No reward is credited to you. They walk away with no charge, and the referral closes."
            />
            <Rule
              label="After trial (during a paid period)"
              text="They keep access until the end of their current billing period, then their account becomes inactive. Your earned days STAY — you brought in a paying customer."
            />
            <Rule
              label="If a refund is issued by support"
              text="The bonus days from that referral are clawed back from your subscription. We never claw back below today — anything you paid for yourself is safe."
            />
          </Section>

          {/* ── The math ─────────────────────────────────────────── */}
          <Section
            icon={CalendarCheck}
            title="How the days are added"
            tone="muted"
          >
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              If your subscription is <strong>active</strong>, the bonus days
              stack on top of your current expiry date. If your subscription
              has <strong>already expired</strong> (you&apos;re in grace period
              or locked), the bonus days start from today — so a reward
              actually brings you back to active immediately.
            </p>
          </Section>

          {/* ── Fair use ─────────────────────────────────────────── */}
          <Section
            icon={ShieldCheck}
            title="Fair use & fraud protection"
            tone="muted"
          >
            <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted-foreground list-disc pl-4">
              <li>You can&apos;t refer your own gym to yourself.</li>
              <li>
                Each gym can only use one referral code, and only on signup.
              </li>
              <li>
                Suspicious patterns (duplicate emails, phones, tax IDs, or
                shared devices) are flagged and may delay or block rewards.
              </li>
              <li>
                MuscleX may reverse rewards earned through abuse, chargebacks,
                or terms-of-service violations.
              </li>
            </ul>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Local presentational helpers ─────────────────────────────────

function Section({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: React.ElementType;
  title: string;
  tone: 'primary' | 'muted' | 'warning';
  children: React.ReactNode;
}) {
  const iconColor =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-muted-foreground';
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {title}
      </h3>
      <div className="space-y-2 pl-1">{children}</div>
    </section>
  );
}

function Step({
  n,
  icon: Icon,
  label,
  text,
}: {
  n: number;
  icon: React.ElementType;
  label: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-canvas-soft-2 flex items-center justify-center text-[11px] font-semibold text-foreground">
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground mt-0.5">
          {text}
        </p>
      </div>
    </div>
  );
}

function Rule({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-canvas-soft px-3 py-2">
      <div className="text-[12px] font-semibold text-foreground">{label}</div>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground mt-0.5">
        {text}
      </p>
    </div>
  );
}
