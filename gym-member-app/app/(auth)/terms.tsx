import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Screen, Txt } from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';

/**
 * Terms of Service — reachable from the welcome / login sheet (pre-auth), so it
 * lives in the (auth) group where AuthGate lets unauthenticated members view it.
 * Plain-language summary of how MuscleX works; have legal review before launch.
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

export default function TermsScreen() {
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View className="pt-md">
        <ScreenHeader title="Terms of Service" className="mb-xs" />
        <Txt variant="caption" className="mt-xs text-mute">
          Last updated 7 June 2026
        </Txt>

        <Txt variant="body-md" className="mt-md text-body">
          Welcome to MuscleX. These terms govern your use of the MuscleX member app, which connects
          you to your gym for check-ins, classes, workouts, nutrition, progress tracking and
          membership management. By creating an account or using the app, you agree to these terms.
        </Txt>

        <Section title="1. Your account">
          You sign in with the mobile number registered at your gym and a one-time code (OTP). You
          are responsible for keeping access to that number secure. Don’t share your account or let
          someone else check in as you.
        </Section>

        <Section title="2. Using the app">
          MuscleX lets you check in to your gym, book and view classes, follow workouts and nutrition
          plans, message your trainer and track your progress. Features depend on what your gym has
          enabled and on your active membership.
        </Section>

        <Section title="3. Membership & payments">
          Your membership, pricing and billing are set by your gym. Where in-app payments are
          available, they’re processed by our payment partner; we don’t store your full card details.
          Refunds and cancellations follow your gym’s policy.
        </Section>

        <Section title="4. Acceptable use">
          Use the app lawfully and respectfully. Don’t attempt to access other members’ data,
          interfere with the service, or check in fraudulently. We may suspend access for misuse.
        </Section>

        <Section title="5. Health & fitness disclaimer">
          MuscleX provides general fitness and wellness information — it is not medical advice.
          Consult a qualified professional before starting any exercise or nutrition program,
          especially if you have a health condition. You exercise at your own risk.
        </Section>

        <Section title="6. Your data">
          We handle your personal and health data as described in our Privacy Policy, which forms
          part of these terms.
        </Section>

        <Section title="7. Changes & termination">
          We may update these terms or the app over time; significant changes will be notified in the
          app. You can stop using MuscleX at any time, and your gym or MuscleX may suspend or close an
          account that breaches these terms.
        </Section>

        <Section title="8. Contact">
          Questions about these terms? Reach us at support@musclex.app or through your gym.
        </Section>

        <Txt variant="caption" className="mb-xl mt-2xl text-mute">
          This is a general summary provided for transparency and is not a substitute for legal
          advice.
        </Txt>
      </View>
    </Screen>
  );
}
