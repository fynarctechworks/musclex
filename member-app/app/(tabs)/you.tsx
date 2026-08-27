import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, LinkGroup, Loading, Row, Txt, type LinkEntry } from '../../src/ui';
import { Icon } from '../../src/ui/Icon';
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

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const who = useWho();
  const { data: stats } = useTrainingStats(30);
  const go = (h: string) => router.push(h as never);

  if (who.loading) return <Loading label="Loading" />;

  const body: LinkEntry[] = [
    { icon: 'progress', label: 'Progress', hint: 'Volume, records and history', href: '/progress' },
    { icon: 'body', label: 'Body', hint: 'Weight and measurements', href: '/body' },
    { icon: 'photos', label: 'Progress photos', hint: 'See the change', href: '/photos' },
    { icon: 'target', label: 'Goals', hint: 'Set and track your own targets', href: '/settings/goals' },
    { icon: 'calendar', label: 'Training calendar', hint: 'Every day you trained', href: '/calendar' },
  ];

  const account: LinkEntry[] = [
    who.hasGym && { icon: 'membership', label: 'Membership', hint: who.gymName ?? 'Your plan', href: '/membership' },
    who.can.attendance && { icon: 'visits', label: 'Visits', hint: 'Every check-in', href: '/visits' },
    { icon: 'me', label: 'Profile', hint: 'Name, units and preferences', href: '/settings/profile' },
    who.can.referralProgram && { icon: 'referral', label: 'Referral', hint: "Apply a friend's code", href: '/referral' },
    { icon: 'tools', label: 'Calculators', hint: 'BMI, calories and macros', href: '/tools' },
    !who.hasGym && { icon: 'location', label: 'Find a gym', hint: 'Browse gyms near you', href: '/gyms' },
  ].filter(Boolean) as LinkEntry[];

  // Dev-only, and its own group rather than a row inside Account: it is a
  // reference for building the UI, not something that belongs to the member.
  // __DEV__ is stripped from a release bundle, so neither this row nor the
  // route behind it can reach a member's phone.
  const developer: LinkEntry[] = __DEV__
    ? [
        { icon: 'info', label: 'Design system', hint: 'Current: theme.ts tokens', href: '/gallery' },
        { icon: 'star', label: 'Design system (preset)', hint: 'Target: shadcn bKsI1x32', href: '/design-system' },
      ]
    : [];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="px-4 pb-36 pt-3 gap-5">
        <View>
          <Txt variant="title">{who.firstName ?? 'You'}</Txt>
          <Txt variant="small" tone="t3" className="mt-0.5">
            {who.hasGym ? (who.gymName ?? 'Gym member') : 'Training independently'}
          </Txt>
        </View>

        {/* Three numbers, not thirty. The full breakdown is one tap away, and
            putting it all here is what made the old Progress tab unreadable.

            The period is announced per stat rather than as one line underneath:
            read by a screen reader, a bare "12 workouts" carried no window at
            all, and the streak is not a 30-day figure like the other two. */}
        <Card>
          <Row className="items-start justify-start gap-8">
            <Stat value={String(stats?.workouts ?? 0)} unit="workouts" days={stats?.periodDays ?? 30} />
            <Stat value={String(stats?.currentStreak ?? 0)} unit="day streak" />
            <Stat value={String(stats?.totalSets ?? 0)} unit="sets" days={stats?.periodDays ?? 30} />
          </Row>
        </Card>

        <LinkGroup title="Your body" entries={body} onGo={go} />
        <LinkGroup title="Account" entries={account} onGo={go} />
        <LinkGroup title="Developer" entries={developer} onGo={go} />
      </ScrollView>
    </View>
  );
}

function Stat({ value, unit, days }: { value: string; unit: string; days?: number }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${value} ${unit}${days ? ` in the last ${days} days` : ''}`}>
      <Txt variant="title">{value}</Txt>
      <Txt variant="caption" tone="t3">
        {unit}
      </Txt>
      {days ? (
        <Txt variant="caption" tone="t4">
          {days} days
        </Txt>
      ) : null}
    </View>
  );
}

