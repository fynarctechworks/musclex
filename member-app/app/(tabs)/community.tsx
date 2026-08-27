import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, LinkGroup, Txt, type LinkEntry } from '../../src/ui';
import { useWho } from '../../src/lib/use-capabilities';

/**
 * COMMUNITY — everything social and everything endurance, behind one door.
 *
 * These eleven screens used to be scattered across the Gym tab and a
 * nineteen-item list inside Me: feed next to check-in, activities next to the
 * exercise library, clubs three taps from challenges. They are one product —
 * the Strava-shaped half of the app — and they live together.
 *
 * None of it needs a gym. Every endpoint behind this tab is on the public
 * surface, so an independent user gets the whole thing.
 */

const SHARE: LinkEntry[] = [
  { icon: 'feed', label: 'Feed', hint: 'What people you follow have done', href: '/feed' },
  {
    icon: 'streak',
    label: 'Your activities',
    hint: 'Every run, ride and walk',
    href: '/activities',
  },
  { icon: 'location', label: 'Heatmap', hint: 'Everywhere you have been', href: '/heatmap' },
];

const PEOPLE: LinkEntry[] = [
  {
    icon: 'findPeople',
    label: 'Find people',
    hint: 'Follow people you train with',
    href: '/people',
  },
  { icon: 'me', label: 'Friends', hint: 'Their sessions and kudos', href: '/friends' },
  { icon: 'messages', label: 'Messages', hint: 'Direct messages', href: '/dm' },
];

const COMPETE: LinkEntry[] = [
  { icon: 'clubs', label: 'Clubs', hint: 'Groups, events and club feeds', href: '/clubs' },
  {
    icon: 'challenge',
    label: 'Challenges',
    hint: 'Distance and streak challenges',
    href: '/challenges',
  },
];

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const who = useWho();
  const go = (h: string) => router.push(h as never);

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="px-4 pb-36 pt-3 gap-5">
        <Txt variant="title">Community</Txt>

        {/* The one thing you DO on this tab; everything else is somewhere to
            look. Same card shape as Today and Train lead with. */}
        <Card className="gap-4 p-5">
          <View className="gap-1">
            <Txt variant="heading">Record an activity</Txt>
            <Txt variant="small" tone="t3">
              Track a run, ride or walk with GPS, then share it to your feed.
            </Txt>
          </View>
          <Button title="Start recording" onPress={() => router.push('/record')} />
        </Card>

        <LinkGroup title="Share" entries={SHARE} onGo={go} />
        <LinkGroup title="People" entries={PEOPLE} onGo={go} />
        <LinkGroup title="Compete" entries={COMPETE} onGo={go} />

        {/* Gym-scoped competition sits apart from the open social layer, and only
            appears for someone who actually has a gym to compete inside. */}
        {who.hasGym ? (
          <LinkGroup
            title={who.gymName ?? 'Your gym'}
            entries={[
              {
                icon: 'goals',
                label: 'Gym challenges',
                hint: 'Badges and leaderboards at your gym',
                href: '/gym-challenges',
              },
            ]}
            onGo={go}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
