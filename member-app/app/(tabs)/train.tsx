import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Label, LinkGroup, Loading, Row, Txt, type LinkEntry } from '../../src/ui';
import { useWho } from '../../src/lib/use-capabilities';

/**
 * TRAIN — the thing the app is for.
 *
 * Starting a workout was once three taps down a nineteen-item list inside a tab
 * called "Me". It is the single most repeated action in the product and it is
 * the first thing on a tab of its own.
 *
 * The gym half is drawn from the server's capability map rather than assumed.
 * An independent user gets routines, the exercise library and their own
 * workouts — the parts that work for them — and is never shown a class-booking
 * button that would return 403.
 *
 * The header block is deliberately the same shape as Today's: a heading, a line
 * of context, and one primary button. Two tabs that lead with the same action
 * should not present it two different ways.
 */

export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const who = useWho();
  const go = (h: string) => router.push(h as never);

  if (who.loading) return <Loading label="Loading" />;

  const yours: LinkEntry[] = [
    { icon: 'routine', label: 'My routines', hint: 'Workouts you have saved', href: '/routines' },
    {
      icon: 'calendar',
      label: 'Your week',
      hint: 'What you train each day',
      href: '/schedule',
    },
    {
      icon: 'exercises',
      label: 'Exercise library',
      hint: 'Form cues and your records',
      href: '/exercises',
    },
    {
      icon: 'progress',
      label: 'Training load',
      hint: 'Fitness, fatigue and projections',
      href: '/training',
    },
  ];

  // Only what this member can actually reach. Every one of these 403s without a
  // gym, so an independent user sees this whole group disappear rather than a
  // list of doors that refuse to open.
  const gym: LinkEntry[] = [
    who.can.classBooking && {
      icon: 'classes',
      label: 'Classes',
      hint: 'Book and cancel',
      href: '/classes',
    },
    who.can.trainerChat && {
      icon: 'coach',
      label: 'Your coach',
      hint: 'Plan and messages',
      href: '/coach',
    },
    who.hasGym && {
      icon: 'assigned',
      label: 'Assigned plan',
      hint: 'What your trainer set',
      href: '/plan',
    },
    // `/scan` is the FRIEND-code scanner and lands on somebody's profile —
    // pointing check-in at it sent members to a social screen while they stood
    // at the desk. The code the desk scans is `/check-in`.
    who.can.attendance && {
      icon: 'scan',
      label: 'Check in',
      hint: 'Show your code at the front desk',
      href: '/check-in',
    },
  ].filter(Boolean) as LinkEntry[];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="px-4 pb-36 pt-3 gap-5">
        <Txt variant="title">Train</Txt>

        {/* The primary action of the entire app. Same composition as Today's
            lead card, so the two tabs read as one product. */}
        <Card className="gap-4 p-5">
          <View className="gap-1">
            <Txt variant="heading">Start a workout</Txt>
            <Txt variant="small" tone="t3">
              Begin from empty and add as you go, or load one of your routines.
            </Txt>
          </View>
          <Button title="Start a workout" onPress={() => router.push('/session')} />
        </Card>

        <LinkGroup title="Yours" entries={yours} onGo={go} />

        {gym.length > 0 ? (
          <LinkGroup title={who.gymName ?? 'Your gym'} entries={gym} onGo={go} />
        ) : (
          /*
            Not an error and not a nag. An independent user is a legitimate user
            of this app, so this states what a gym would add and offers the one
            action that leads there — once, quietly, at the bottom.
          */
          <View>
            <Row className="mb-2">
              <Label>No gym linked</Label>
            </Row>
            <Card className="gap-3">
              <Txt variant="small" tone="t2">
                Everything above works on its own. Linking a gym adds classes, check-in and a
                trainer who can set your plan.
              </Txt>
              <Pressable
                onPress={() => router.push('/gyms')}
                accessibilityRole="button"
                accessibilityLabel="Find a gym near you"
                hitSlop={6}>
                <Txt variant="small" tone="accent" className="font-semibold">
                  Find a gym near you ›
                </Txt>
              </Pressable>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

