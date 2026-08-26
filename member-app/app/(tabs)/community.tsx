import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Label, Row, Txt } from '../../src/ui';
import { Icon, type IconName } from '../../src/ui/Icon';
import { color, radius, space } from '../../src/ui/theme';
import { Pressable } from 'react-native';
import { useWho } from '../../src/lib/use-capabilities';

/**
 * COMMUNITY — everything social and everything endurance, behind one door.
 *
 * These eleven screens used to be scattered across the Gym tab and a
 * nineteen-item list inside Me: feed next to check-in, activities next to the
 * exercise library, clubs three taps from challenges. They are one product —
 * the Strava-shaped half of the app — and they now live together.
 *
 * None of it needs a gym. Every endpoint behind this tab is on the public
 * surface, so an independent user gets the whole thing.
 */

interface Entry {
  icon: IconName;
  label: string;
  hint: string;
  href: string;
}

const SHARE: Entry[] = [
  { icon: 'feed', label: 'Feed', hint: 'What people you follow have done', href: '/feed' },
  { icon: 'streak', label: 'Your activities', hint: 'Every run, ride and walk', href: '/activities' },
  { icon: 'location', label: 'Heatmap', hint: 'Everywhere you have been', href: '/heatmap' },
];

const PEOPLE: Entry[] = [
  { icon: 'findPeople', label: 'Find people', hint: 'Follow people you train with', href: '/people' },
  { icon: 'me', label: 'Friends', hint: 'Their sessions and kudos', href: '/friends' },
  { icon: 'messages', label: 'Messages', hint: 'Direct messages', href: '/dm' },
];

const COMPETE: Entry[] = [
  { icon: 'clubs', label: 'Clubs', hint: 'Groups, events and club feeds', href: '/clubs' },
  { icon: 'challenge', label: 'Challenges', hint: 'Distance and streak challenges', href: '/challenges' },
];

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const who = useWho();

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.lg }}
      >
        <Txt variant="title">Community</Txt>

        <Hero
          onPress={() => router.push('/record')}
          title="Record an activity"
          body="Track a run, ride or walk with GPS."
        />

        <Group title="Share" entries={SHARE} onGo={(h) => router.push(h as never)} />
        <Group title="People" entries={PEOPLE} onGo={(h) => router.push(h as never)} />
        <Group title="Compete" entries={COMPETE} onGo={(h) => router.push(h as never)} />

        {/* Gym-scoped competition sits apart from the open social layer, and only
            appears for someone who actually has a gym to compete inside. */}
        {who.hasGym ? (
          <Group
            title={who.gymName ?? 'Your gym'}
            entries={[
              {
                icon: 'goals',
                label: 'Gym challenges',
                hint: 'Badges and leaderboards at your gym',
                href: '/gym-challenges',
              },
            ]}
            onGo={(h) => router.push(h as never)}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Hero({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        backgroundColor: color.accent,
        borderRadius: radius.lg,
        padding: space.lg,
        // Opacity rather than a transform: a scale on press moves the cards
        // underneath it and the whole list jitters.
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Row style={{ gap: space.md, justifyContent: 'flex-start' }}>
        <Icon name="add" size={26} tone="inverse" decorative />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" style={{ color: color.accentInk }}>{title}</Txt>
          <Txt variant="caption" style={{ color: color.accentInk, opacity: 0.85 }}>{body}</Txt>
        </View>
      </Row>
    </Pressable>
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
          <View key={e.href}>
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
                // 56 tall keeps every row past the 44pt minimum with room to spare.
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
