import type { Metadata } from 'next';
import { LegalList, LegalPage, LegalSection } from '@/components/legal';
import { contactEmail, routes, securityEmail } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'How MuscleX collects, uses, stores and shares personal data belonging to gym operators and their members.',
  alternates: { canonical: routes.privacy },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="27 August 2026"
      // This URL is what Apple and Google are given as the app's privacy
      // policy. A banner calling it a non-binding draft works against that.
      draft={false}
      intro="MuscleX is gym management software. Gyms use it to run their business, which means we process personal data about gym staff and about gym members. This page explains what is collected, why, and what happens to it."
    >
      <LegalSection heading="1. Who controls the data">
        <p>
          MuscleX operates as a <strong>processor</strong> for the member data held in a
          gym&rsquo;s account. The gym (the &ldquo;studio&rdquo;) is the{' '}
          <strong>controller</strong>: it decides which members to add, what to record
          about them, and how long to keep it. MuscleX processes that data on the
          studio&rsquo;s instructions in order to provide the service.
        </p>
        <p>
          For the studio&rsquo;s own account data, such as the operator who signs up, billing
          details and support correspondence, MuscleX acts as the controller.
        </p>
        <p>
          If you are a gym member and want your data corrected or deleted, contact your
          gym first. They control the record. We will support them in acting on your
          request.
        </p>
      </LegalSection>

      <LegalSection heading="2. What we collect">
        <p>
          <strong>From studio operators and staff:</strong>
        </p>
        <LegalList
          items={[
            'Account details: name, email address, phone number, role and branch assignment.',
            'Authentication data: password hashes, two-factor secrets, active sessions, signed-in devices and login history including IP address and timestamps.',
            'Billing details for the MuscleX subscription itself.',
            'Support correspondence and anything you choose to send us.',
          ]}
        />
        <p>
          <strong>About gym members, entered by the studio:</strong>
        </p>
        <LegalList
          items={[
            'Identity and contact details: name, phone number, email address, date of birth, address, emergency contact and photograph.',
            'Membership records: plan, start and expiry dates, freezes, upgrades and access entitlements.',
            'Attendance records: check-in and check-out events, method used, branch and timestamp.',
            'Financial records: invoices, payments, dues, refunds, wallet balances and store purchases. Card details are handled by the payment gateway and are not stored by MuscleX.',
            'Documents the studio uploads against a member record.',
            'Fitness and health data entered through the member app: workouts, nutrition logs, body metrics, and activity, heart or sleep data the member chooses to record or connect.',
            'Messages exchanged with trainers through the in-app chat, and posts made in the studio community feed.',
            'Biometric data, meaning face descriptors, only where the studio has enabled facial check-in and the member has enrolled.',
          ]}
        />
        <p>
          <strong>Collected automatically:</strong> technical logs needed to operate and
          secure the service, including request metadata, error reports and correlation
          identifiers.
        </p>
      </LegalSection>

      <LegalSection heading="3. Biometric data">
        <p>
          Facial check-in is optional and off unless a studio switches it on. Where it is
          enabled and a member enrols, a mathematical descriptor derived from their face
          is stored so that future check-ins can be matched against it.
        </p>
        <LegalList
          items={[
            'Face descriptors are never returned by the API to any client application.',
            'Members who do not wish to enrol can check in by QR code, an access device, or at the front desk, with no reduction in their access rights.',
            'Biometric data is subject to specific and varying legal requirements. Studios enabling this feature are responsible for obtaining valid consent and meeting the obligations that apply in their jurisdiction.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. The mobile apps">
        <p>
          MuscleX has two mobile apps: <strong>MuscleX Staff</strong>, used by gym
          employees, and <strong>MuscleX</strong>, used by members. Both collect some
          things on the device itself that the web app does not.
        </p>
        <LegalList
          items={[
            'Camera: the staff app uses the camera to scan a member’s QR code at check-in. Frames are decoded on the device and discarded. No photograph is stored, uploaded, or sent anywhere.',
            'Push notifications: if you allow them, the device is issued a push token by Apple or Google, which we store so the app can be notified. It identifies the handset, not you. Signing out deletes it from every gym the account belongs to.',
            'On-device storage: sign-in tokens are held in the device keychain, and recent gym data is cached so the app keeps working when the connection drops. Signing out clears both.',
            'Crash reports: if a crash reporter is enabled for a release, we receive the stack trace, app version, device model and OS version. Request bodies, query strings and console logs are stripped before sending, identifiers in URLs are masked, and the report carries a staff or member row identifier, role and gym — never a name, email or phone number.',
            'Location: the member app can record the route of a run, ride or walk. This is opt-in, used only while a member is recording an activity, and never collected by the staff app.',
            'Health and fitness data: the member app records what the member enters, and reads from Apple Health or Google Fit only if the member connects it. It is used to show the member their own progress and to share it with their gym where they have chosen to train with one. It is never used for advertising.',
          ]}
        />
        <p>
          Neither app contains third-party advertising or analytics SDKs, and neither
          tracks you across other companies&rsquo; apps or websites.
        </p>
      </LegalSection>

      <LegalSection heading="5. Why we process it">
        <LegalList
          items={[
            'To provide the service the studio has subscribed to: memberships, attendance, scheduling, billing, staff management and reporting.',
            'To operate the member app for members of that studio.',
            'To send operational communications a studio configures, such as renewal reminders and class notifications.',
            'To generate analytics and retention insights for the studio, computed only from that studio’s own data.',
            'To secure the platform: detecting abuse, rate limiting, lockouts and audit trails.',
            'To bill studios for their MuscleX subscription and to provide support.',
            'To comply with legal and tax obligations.',
          ]}
        />
        <p>
          We do not sell personal data. We do not use one studio&rsquo;s data to train
          models or generate insights for another studio.
        </p>
      </LegalSection>

      <LegalSection heading="6. Automated processing and AI features">
        <p>
          MuscleX includes AI features: a business advisor, a morning briefing and churn
          risk scoring. These operate on a studio&rsquo;s own operational data and produce
          suggestions for staff to consider. They do not make decisions with legal or
          similarly significant effects on a member automatically; a person at the studio
          decides what to act on.
        </p>
      </LegalSection>

      <LegalSection heading="7. Who we share it with">
        <p>
          We share personal data only with the service providers needed to run the
          platform, and only as far as each needs to do its job:
        </p>
        <LegalList
          items={[
            'Cloud database and file storage hosting.',
            'Payment processing, for collecting member payments and studio subscriptions.',
            'Messaging delivery over email, SMS, WhatsApp Business and mobile push, where a studio has enabled those channels.',
            'Error monitoring and operational logging.',
            'AI model providers, for the AI advisor features, where a studio uses them.',
          ]}
        />
        <p>
          We may also disclose data where required by law, or to protect the rights and
          safety of users and the platform.
        </p>
      </LegalSection>

      <LegalSection heading="8. Retention">
        <p>
          Member data is retained for as long as the studio maintains it in their account.
          When a studio deletes a record, it is removed in accordance with our deletion
          processes and backup cycles. Account and billing records are retained for as
          long as legal and tax obligations require.
        </p>
      </LegalSection>

      <LegalSection heading="9. Security">
        <p>
          Each studio&rsquo;s data is kept separate from every other studio&rsquo;s. Access
          requires authentication, every request is scoped to the signed-in studio, and
          sensitive fields, including face descriptors, payment tokens, password hashes
          and two-factor secrets, are stripped from API responses centrally. A fuller
          description is on our <a href={routes.security}>security page</a>.
        </p>
        <p>
          No system is perfectly secure. If you believe you have found a vulnerability,
          please write to <a href={`mailto:${securityEmail}`}>{securityEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection heading="10. Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, delete,
          restrict or port your personal data, and to object to certain processing. Gym
          members should raise these with their gym, which controls the record. Studio
          operators can contact us directly at{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection heading="11. Children">
        <p>
          MuscleX is not directed at children. Where a studio enrols a minor, the studio is
          responsible for obtaining the consent required in its jurisdiction and for the
          data it records about them.
        </p>
      </LegalSection>

      <LegalSection heading="12. Changes">
        <p>
          We will update this page when our practices change and revise the &ldquo;last
          updated&rdquo; date above. Material changes affecting studios will be
          communicated directly.
        </p>
      </LegalSection>

      <LegalSection heading="13. Contact">
        <p>
          Questions about this policy: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
