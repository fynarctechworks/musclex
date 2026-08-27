import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Label, Loading, Row, Txt } from '../../src/ui';
import { Icon, type IconName } from '../../src/ui/Icon';
import { color, radius, space } from '../../src/ui/theme';
import { useWho } from '../../src/lib/use-capabilities';
import { useTrainingStats } from '../../src/api/queries';

/**
 * YOU — how you are doing, and everything that is yours.
 *
 * Replaces two tabs that were each half a screen. "Progress" was a wall of
 * statistics with no way to reach your account; "Me" was a nineteen-item list
 * that had quietly become the app's sitemap, holding nutrition, routines,
 * classes and the exercise library because there was nowhere else to put them.
 *
 * Those four moved to the tabs that answer the question they belong to. What
 * is left here is genuinely about the person: their numbers, their body, their
 * membership, their settings.
 */

interface Entry {
  icon: IconName;
  label: string;
  hint: string;
  href: string;
}

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const who = useWho();
  const { data: stats } = useTrainingStats(30);

  if (who.loading) return <Loading label="Loading" />;

  const body: Entry[] = [
    { icon: 'progress', label: 'Progress', hint: 'Volume, records and history', href: '/progress' },
    { icon: 'body', label: 'Body', hint: 'Weight and measurements', href: '/body' },
    { icon: 'photos', label: 'Progress photos', hint: 'See the change', href: '/photos' },
    { icon: 'target', label: 'Goals', hint: 'Set and track your own targets', href: '/settings/goals' },
    { icon: 'calendar', label: 'Training calendar', hint: 'Every day you trained', href: '/calendar' },
  ];

  const account: Entry[] = [
    who.hasGym && { icon: 'membership', label: 'Membership', hint: who.gymName ?? 'Your plan', href: '/membership' },
    who.can.attendance && { icon: 'visits', label: 'Visits', hint: 'Every check-in', href: '/visits' },
    { icon: 'me', label: 'Profile', hint: 'Name, units and preferences', href: '/settings/profile' },
    who.can.referralProgram && { icon: 'referral', label: 'Referral', hint: "Apply a friend's code", href: '/referral' },
    { icon: 'tools', label: 'Calculators', hint: 'BMI, calories and macros', href: '/tools' },
    !who.hasGym && { icon: 'location', label: 'Find a gym', hint: 'Browse gyms near you', href: '/gyms' },
  ].filter(Boolean) as Entry[];

  // Dev-only, and its own group rather than a row inside Account: it is a
  // reference for building the UI, not something that belongs to the member.
  // __DEV__ is stripped from a release bundle, so neither this row nor the
  // route behind it can reach a member's phone.
  const developer: Entry[] = __DEV__
    ? [
        { icon: 'info', label: 'Design system', hint: 'Current: theme.ts tokens', href: '/gallery' },
        { icon: 'star', label: 'Design system (preset)', hint: 'Target: shadcn bKsI1x32', href: '/design-system' },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.lg }}>
        <View>
          <Txt variant="title">{who.firstName ?? 'You'}</Txt>
          <Txt variant="caption" tone="t3">
            {who.hasGym ? (who.gymName ?? 'Gym member') : 'Training independently'}
          </Txt>
        </View>

        {/* Three numbers, not thirty. The full breakdown is one tap away, and
            putting it all here is what made the old Progress tab unreadable. */}
        <Card>
          <Row style={{ justifyContent: 'flex-start', gap: space['2xl'] }}>
            <Stat value={String(stats?.workouts ?? 0)} unit="workouts" />
            <Stat value={String(stats?.currentStreak ?? 0)} unit="day streak" />
            <Stat value={String(stats?.totalSets ?? 0)} unit="sets" />
          </Row>
          <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>
            Last {stats?.periodDays ?? 30} days
          </Txt>
        </Card>

        <Group title="Your body" entries={body} onGo={(h) => router.push(h as never)} />
        <Group title="Account" entries={account} onGo={(h) => router.push(h as never)} />
        {developer.length ? (
          <Group title="Developer" entries={developer} onGo={(h) => router.push(h as never)} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <View>
      <Txt variant="title">{value}</Txt>
      <Txt variant="caption" tone="t3">{unit}</Txt>
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
