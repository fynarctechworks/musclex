import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Screen, Txt } from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';

/**
 * Privacy Policy — reachable from the welcome / login sheet (pre-auth), so it
 * lives in the (auth) group where AuthGate lets unauthenticated members view it.
 * Plain-language summary of what MuscleX collects; have legal review before launch.
 */

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <View className="mt-lg">
    <Txt variant="body-lg" weight="600" className="text-ink">
      {title}
    </Txt>
    <Txt variant="body-md" className="mt-xs text-body">
      {children}
    </Txt>
  </View>
);

export default function PrivacyScreen() {
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View className="pt-md">
        <ScreenHeader title="Privacy Policy" className="mb-xs" />
        <Txt variant="caption" className="mt-xs text-mute">
          Last updated 7 June 2026
        </Txt>

        <Txt variant="body-md" className="mt-md text-body">
          MuscleX is a member app for gyms. This policy explains what we collect, why, and the choices
          you have. We collect only what we need to run your gym experience — we don’t sell your data.
        </Txt>

        <Section title="What we collect">
          • Account details — your mobile number and the profile your gym holds (name, membership).{'\n'}
          • Activity in the app — check-ins, class bookings, workouts, nutrition logs and progress.{'\n'}
          • Health & wearable data — only if you connect it (e.g. steps, heart rate, sleep) via your
          device’s health platform.{'\n'}
          • Technical data — basic device and usage information to keep the app working.
        </Section>

        <Section title="How we use it">
          To verify check-ins, deliver classes, workouts and nutrition, show your progress, support
          your membership and payments, send notifications you’ve turned on, and improve the app.
        </Section>

        <Section title="Who we share it with">
          Your gym (the studio you belong to) can see the data needed to serve you. We use trusted
          processors — for example, our payment and infrastructure partners — strictly to operate the
          service. We never sell your personal data or use your health data for advertising.
        </Section>

        <Section title="Your health data">
          Health and biometric data (including any wearable or face check-in data) is used only for
          the feature you enabled it for. You can disconnect a health source or revoke device
          permissions at any time.
        </Section>

        <Section title="Keeping it isolated & secure">
          Each gym’s member data is kept separate from other gyms’, and access is protected in
          transit and at rest. We apply reasonable safeguards to prevent unauthorized access.
        </Section>

        <Section title="Your choices">
          You can view and update your profile, manage notifications in Settings, and request a copy
          or deletion of your data. Some records may be retained where required for legal or billing
          reasons.
        </Section>

        <Section title="Children">
          MuscleX is not intended for children under the age your gym requires for membership without
          appropriate consent.
        </Section>

        <Section title="Contact">
          Privacy questions or requests? Email privacy@musclex.app or contact your gym.
        </Section>

        <Txt variant="caption" className="mb-xl mt-2xl text-mute">
          This is a general summary provided for transparency and is not a substitute for legal
          advice.
        </Txt>
      </View>
    </Screen>
  );
}
