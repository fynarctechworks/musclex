import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Label, ListCard, Loading, Row, RowLink, Txt } from '../../src/ui';
import { type IconName } from '../../src/ui/Icon';
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

interface Entry {
  icon: IconName;
  label: string;
  hint: string;
  href: string;
}

export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const who = useWho();

  if (who.loading) return <Loading label="Loading" />;

  const yours: Entry[] = [
    { icon: 'routine', label: 'My routines', hint: 'Workouts you have saved', href: '/routines' },
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
  const gym: Entry[] = [
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
    who.can.attendance && {
      icon: 'scan',
      label: 'Check in',
      hint: 'Scan at the front desk',
      href: '/scan',
    },
  ].filter(Boolean) as Entry[];

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

        <Group title="Yours" entries={yours} onGo={(h) => router.push(h as never)} />

        {gym.length > 0 ? (
          <Group
            title={who.gymName ?? 'Your gym'}
            entries={gym}
            onGo={(h) => router.push(h as never)}
          />
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

function Group({
  title,
  entries,
  onGo,
}: {
  title: string;
  entries: Entry[];
  onGo: (href: string) => void;
}) {
  return (
    <View>
      <Row className="mb-2">
        <Label>{title}</Label>
      </Row>
      <ListCard>
        {entries.map((e, i) => (
          <RowLink
            key={e.href + e.label}
            icon={e.icon}
            label={e.label}
            hint={e.hint}
            first={i === 0}
            onPress={() => onGo(e.href)}
          />
        ))}
      </ListCard>
    </View>
  );
}
