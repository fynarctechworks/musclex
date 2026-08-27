import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Txt } from '../src/ui';
import { Icon, type IconName } from '../src/ui/Icon';
import { color, radius, space } from '../src/ui/theme';
import { markWelcomeSeen } from '../src/api/auth';

/**
 * ────────────────────────────────────────────────────────────────
 * WELCOME — the first thing a new install sees
 * ────────────────────────────────────────────────────────────────
 *
 * Before this, the first screen was the sign-in wall, and it said:
 *
 *     "Your gym issues your account. If your number is not recognised,
 *      ask at the front desk."
 *
 * Two problems. It never said what the app DOES, so anyone who had not
 * already been told by their gym had no idea what they had installed. And
 * since the gym-less surface shipped it is no longer true — an account is
 * created for any verified number, gym or not — so the one sentence a new
 * person read was actively turning away half the people it was written for.
 *
 * This screen answers "what is this and is it for me?" in the time it takes
 * to look at it, and it is shown ONCE per install. It is not a tutorial and
 * has no carousel: nobody arriving at a fitness app wants to be taught how to
 * use it before they have seen it.
 */

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'gym',
    title: 'Workouts that remember',
    body: 'Build routines, log every set, and watch your lifts go up over time.',
  },
  {
    icon: 'streak',
    title: 'Runs, rides and walks',
    body: 'Record with GPS, see your route, and follow people you train with.',
  },
  {
    icon: 'water',
    title: 'The daily stuff',
    body: 'Water, steps and meals — the habits that decide the rest of it.',
  },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function go() {
    /*
      Written BEFORE navigating, so a member who kills the app on the sign-in
      screen does not get introduced to it all over again.

      But a FAILED write must never block the way forward. This flag lives in
      SecureStore, which is backed by the keychain, and the keychain is not
      always available — an unsigned build has no entitlement for it, and a
      device can refuse for its own reasons. Awaiting it unguarded meant the
      rejection propagated, router.replace never ran, and the only button on
      the first screen of the app did nothing at all with no error shown.

      The read side already tolerates this (see hasSeenWelcome in _layout,
      which defaults to "seen"); the write side did not. Worst case now is
      being introduced to the app twice, which is a far better failure than
      being unable to start it.
    */
    await markWelcomeSeen().catch(() => {});
    router.replace('/sign-in');
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bg,
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + space.lg,
        paddingHorizontal: space.lg,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: space['2xl'] }}>
        <View>
          <Txt variant="display">MUSCLE<Txt variant="display" tone="accent">X</Txt></Txt>
          <Txt variant="heading" tone="t2" style={{ marginTop: space.sm }}>
            Train with your gym, or entirely on your own.
          </Txt>
        </View>

        <View style={{ gap: space.lg }}>
          {POINTS.map((p) => (
            <View key={p.title} style={{ flexDirection: 'row', gap: space.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: color.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={p.icon} size={20} tone="accent" decorative />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{p.title}</Txt>
                <Txt variant="small" tone="t2" style={{ marginTop: 2 }}>
                  {p.body}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <Button title="Get started" onPress={go} />
        {/*
          The gym half, stated as a BONUS rather than a requirement — which is
          the exact inversion of what the sign-in screen used to say.
        */}
        <Txt variant="caption" tone="t3" style={{ textAlign: 'center' }}>
          If your gym uses MuscleX, sign in with the number they have on file and
          you will get classes, check-in and your trainer's plan too.
        </Txt>
      </View>
    </View>
  );
}
