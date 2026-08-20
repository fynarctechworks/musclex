import type { Metadata } from 'next';
import { LegalList, LegalPage, LegalSection } from '@/components/legal';
import { routes, supportEmail } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Refund policy',
  description:
    'How refunds, cancellations and plan changes work for MuscleX subscriptions, and how member payments collected through MuscleX are handled.',
  alternates: { canonical: routes.refund },
};

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund policy"
      updated="17 August 2026"
      intro="This page covers refunds and cancellations for your MuscleX subscription. It also explains the difference between that and the payments you collect from your own members through the platform. The two are not the same thing."
    >
      <LegalSection heading="1. Try before you pay">
        <p>
          The Free plan exists so you do not have to buy in order to evaluate MuscleX. It
          covers up to 50 members, one branch and three staff, including check-in, manual
          payments, invoicing and reports, and it does not expire. We would rather you
          outgrow the free plan than ask for your money back.
        </p>
      </LegalSection>

      <LegalSection heading="2. Cancelling a paid plan">
        <LegalList
          items={[
            'You can cancel at any time from your subscription settings.',
            'Cancellation stops the next renewal. Your plan stays active until the end of the cycle you have already paid for.',
            'We do not automatically refund the unused remainder of a cycle on cancellation.',
            'Your data remains available to export for a reasonable period after the subscription ends.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. When we will refund">
        <p>We will issue a refund in these circumstances:</p>
        <LegalList
          items={[
            'Duplicate or accidental charge: refunded in full.',
            'A charge taken after a valid cancellation: refunded in full.',
            'A billing error on our side: refunded in full.',
            'A sustained failure of the service that we were unable to resolve, and which materially prevented you from using the plan you paid for: refunded proportionally for the affected period.',
          ]}
        />
        <p>
          Requests outside these cases are considered individually. Write to{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a> with your studio name and
          the invoice in question.
        </p>
      </LegalSection>

      <LegalSection heading="4. Plan changes">
        <p>
          Upgrades and downgrades mid-cycle are prorated: what you pay reflects the portion
          of the cycle spent on each plan. A downgrade does not generate a cash refund; the
          credit is applied against your subsequent billing.
        </p>
        <p>
          Annual plans are priced at a discount in exchange for the commitment. Switching
          from annual to monthly takes effect at the end of the annual term.
        </p>
      </LegalSection>

      <LegalSection heading="5. Payments you collect from your members">
        <p>
          This policy governs what <strong>you</strong> pay <strong>us</strong>. It does not
          govern what your members pay you.
        </p>
        <LegalList
          items={[
            'Membership fees, class packs and store purchases collected through MuscleX are transactions between your studio and your member.',
            'Your studio sets its own refund and cancellation terms for those payments, and is responsible for publishing them to your members.',
            'MuscleX provides the tooling to record refunds, credits and wallet adjustments against a member’s record; the commercial decision is yours.',
            'Where an online payment is refunded, the timing of funds reaching the member is determined by the payment gateway and their bank.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. How to request a refund">
        <p>
          Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> with your studio name,
          the invoice or payment reference and a short description of the problem. We aim to
          respond within a few business days and to process approved refunds to the original
          payment method.
        </p>
      </LegalSection>

      <LegalSection heading="7. Related">
        <p>
          See also the <a href={routes.terms}>terms of service</a> and the{' '}
          <a href={routes.privacy}>privacy policy</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
