import type { Metadata } from 'next';
import { LegalList, LegalPage, LegalSection } from '@/components/legal';
import { contactEmail, routes } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of service',
  description:
    'The terms under which gyms and fitness studios may use the MuscleX platform, including subscriptions, acceptable use, data responsibilities and liability.',
  alternates: { canonical: routes.terms },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="17 August 2026"
      intro="These terms govern the use of MuscleX by gyms, fitness studios and their staff. By creating an account you agree to them on behalf of your business."
    >
      <LegalSection heading="1. The service">
        <p>
          MuscleX is a subscription platform for managing a fitness business: memberships,
          check-in and attendance, class scheduling, payments and invoicing, staff
          management, marketing, analytics and a member-facing mobile application.
        </p>
        <p>
          Which capabilities are available depends on your subscription plan. Current plan
          limits and entitlements are listed on the{' '}
          <a href={routes.pricing}>pricing page</a> and are enforced by the product.
        </p>
      </LegalSection>

      <LegalSection heading="2. Accounts">
        <LegalList
          items={[
            'You must provide accurate registration details and keep them current.',
            'You are responsible for all activity under your studio’s accounts, including accounts you create for staff.',
            'You must keep credentials confidential and notify us promptly of any suspected unauthorised access.',
            'You are responsible for revoking access when a staff member leaves.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Subscriptions, billing and renewal">
        <LegalList
          items={[
            'Paid plans are billed in advance on the cycle you select, monthly or annual. Prices are in Indian Rupees and exclusive of applicable taxes.',
            'Subscriptions renew automatically at the end of each cycle unless cancelled before the renewal date.',
            'Plan changes mid-cycle are prorated against the portion of the cycle used on each plan.',
            'The Free plan is provided without charge and subject to the limits published on the pricing page.',
            'We may change prices with reasonable notice. Changes take effect at your next renewal, never mid-cycle.',
            'Failure to pay may result in suspension of access after notice. Your data is retained during suspension in accordance with our retention practices.',
          ]}
        />
        <p>
          Refunds are governed by our <a href={routes.refund}>refund policy</a>.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your data and your members">
        <p>
          You retain ownership of the data you and your members put into MuscleX. You grant
          us the limited rights needed to host, process and display it in order to provide
          the service.
        </p>
        <p>As the controller of your members&rsquo; data, you are responsible for:</p>
        <LegalList
          items={[
            'Having a lawful basis for collecting and processing member data.',
            'Telling your members what you collect and why, including through your own privacy notice.',
            'Obtaining valid consent where required, in particular before enrolling any member in facial check-in.',
            'Responding to your members’ requests about their own data.',
            'The accuracy of what you record, and the messages you send from the platform.',
          ]}
        />
        <p>
          Our handling of that data is described in the{' '}
          <a href={routes.privacy}>privacy policy</a>.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            'Use the platform for any unlawful purpose, or in breach of any regulation applying to your business.',
            'Attempt to access another studio’s data, or probe, scan or test the platform’s security without written authorisation.',
            'Interfere with or disrupt the platform, or circumvent plan limits, rate limits or access controls.',
            'Send unsolicited or unlawful messages to members through the platform’s messaging features.',
            'Resell, sublicense or white-label the service without a written agreement with us.',
            'Reverse engineer the platform except to the extent that restriction is unenforceable by law.',
          ]}
        />
        <p>
          We may suspend accounts engaged in activity that threatens the platform or other
          studios, with notice where circumstances allow.
        </p>
      </LegalSection>

      <LegalSection heading="6. Third-party services">
        <p>
          Payments, messaging, email delivery and AI features rely on third-party providers.
          Your use of those features is also subject to the relevant provider&rsquo;s terms.
          We are not responsible for the availability or acts of third-party services, but
          we will tell you if one materially affects the platform.
        </p>
      </LegalSection>

      <LegalSection heading="7. Availability">
        <p>
          We work to keep MuscleX available and performant, but the service is provided
          without an uptime guarantee unless a separate written agreement says otherwise.
          Planned maintenance will be communicated in advance where practical.
        </p>
      </LegalSection>

      <LegalSection heading="8. Intellectual property">
        <p>
          MuscleX, its software, design and branding remain our property. These terms grant
          you a limited, non-exclusive, non-transferable right to use the service during
          your subscription. Nothing here transfers ownership of our intellectual property
          to you, or of yours to us.
        </p>
      </LegalSection>

      <LegalSection heading="9. Termination">
        <LegalList
          items={[
            'You may cancel at any time; cancellation takes effect at the end of the current billing cycle.',
            'We may terminate for material breach of these terms, with notice and an opportunity to remedy where the breach is capable of remedy.',
            'On termination you may export your data for a reasonable period, after which it may be deleted in accordance with our retention practices.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="10. Disclaimers and liability">
        <p>
          Except as expressly stated, the service is provided &ldquo;as is&rdquo;. To the
          maximum extent permitted by law we exclude implied warranties, and our aggregate
          liability arising out of or relating to the service is limited to the fees you
          paid in the twelve months preceding the event giving rise to the claim.
        </p>
        <p>
          Nothing in these terms limits liability that cannot lawfully be limited, including
          for fraud or for death or personal injury caused by negligence.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these terms">
        <p>
          We may update these terms. Material changes will be notified to studio account
          owners in advance, and continued use after they take effect constitutes
          acceptance.
        </p>
      </LegalSection>

      <LegalSection heading="12. Governing law and contact">
        <p>
          The governing law and jurisdiction for these terms are to be confirmed as part of
          legal review before publication. Questions in the meantime:{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
