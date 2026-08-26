import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Label, Loading, Row, Txt } from '../../src/ui';
import { Icon, type IconName } from '../../src/ui/Icon';
import { color, radius, space } from '../../src/ui/theme';
import { useWho } from '../../src/lib/use-capabilities';

/**
 * TRAIN — the thing the app is for.
 *
 * Starting a workout was previously three taps down a nineteen-item list
 * inside a tab called "Me". It is the single most repeated action in the
 * product and it is now the first thing on a tab of its own.
 *
 * The gym half of this screen is drawn from the server's capability map rather
 * than assumed. An independent user with no gym gets routines, the exercise
 * library and their own workouts — the parts that work for them — and is never
 * shown a class-booking button that would return 403.
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
    { icon: 'exercises', label: 'Exercise library', hint: 'Form cues and your records', href: '/exercises' },
    { icon: 'progress', label: 'Training load', hint: 'Fitness, fatigue and projections', href: '/training' },
  ];

  // Only what this member can actually reach. Every one of these 403s without
  // a gym, so an independent user sees this whole group disappear rather than
  // a list of doors that refuse to open.
  const gym: Entry[] = [
    who.can.classBooking && { icon: 'classes', label: 'Classes', hint: 'Book and cancel', href: '/classes' },
    who.can.trainerChat && { icon: 'coach', label: 'Your coach', hint: 'Plan and messages', href: '/coach' },
    who.hasGym && { icon: 'assigned', label: 'Assigned plan', hint: 'What your trainer set', href: '/plan' },
    who.can.attendance && { icon: 'scan', label: 'Check in', hint: 'Scan at the front desk', href: '/scan' },
  ].filter(Boolean) as Entry[];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.lg }}>
        <Txt variant="title">Train</Txt>

        {/* The primary action of the entire app, at the top, full width. */}
        <Pressable
          onPress={() => router.push('/session')}
          accessibilityRole="button"
          accessibilityLabel="Start a workout"
          style={({ pressed }) => ({
            backgroundColor: color.accent,
            borderRadius: radius.lg,
            padding: space.xl,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Row style={{ gap: space.md, justifyContent: 'flex-start' }}>
            <Icon name="gym" size={28} tone="inverse" decorative />
            <View style={{ flex: 1 }}>
              <Txt variant="heading" style={{ color: color.accentInk }}>Start a workout</Txt>
              <Txt variant="caption" style={{ color: color.accentInk, opacity: 0.85 }}>
                Empty session, or load a routine
              </Txt>
            </View>
          </Row>
        </Pressable>

        <Group title="Yours" entries={yours} onGo={(h) => router.push(h as never)} />

        {gym.length > 0 ? (
          <Group title={who.gymName ?? 'Your gym'} entries={gym} onGo={(h) => router.push(h as never)} />
        ) : (
          /*
            Not an error and not a nag. An independent user is a legitimate
            user of this app, so this states what a gym would add and offers
            the one action that leads there — once, quietly, at the bottom.
          */
          <Card>
            <Label>No gym linked</Label>
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              Everything above works on its own. Linking a gym adds classes, check-in
              and a trainer who can set your plan.
            </Txt>
            <Pressable
              onPress={() => router.push('/gyms')}
              accessibilityRole="button"
              accessibilityLabel="Find a gym near you"
              style={({ pressed }) => ({ marginTop: space.md, opacity: pressed ? 0.6 : 1 })}
            >
              <Txt variant="small" tone="accent" style={{ fontWeight: '600' }}>
                Find a gym near you
              </Txt>
            </Pressable>
          </Card>
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
    <View style={{ gap: space.sm }}>
      <Label>{title}</Label>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {entries.map((e, i) => (
          <View key={e.href + e.label}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: color.line }} /> : null}
            <Pressable
              onPress={() => onGo(e.href)}
              accessibilityRole="button"
              accessibilityLabel={`${e.label}. ${e.hint}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingHorizontal: space.lg,
                minHeight: 56,
                backgroundColor: pressed ? color.surface2 : 'transparent',
              })}
            >
              <Icon name={e.icon} size={21} tone="t2" decorative />
              <View style={{ flex: 1 }}>
                <Txt variant="body">{e.label}</Txt>
                <Txt variant="caption" tone="t3">{e.hint}</Txt>
              </View>
              <Icon name="chevron" size={16} tone="t4" decorative />
            </Pressable>
          </View>
        ))}
      </Card>
    </View>
  );
}
