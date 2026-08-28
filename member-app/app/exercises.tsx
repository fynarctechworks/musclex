import { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Empty, Label, ListCard, Loading, Row, Txt } from '../src/ui';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Chip } from '../src/ui/Chip';
import { useExercises } from '../src/api/queries';
import { buildHeadSections, groupsFor, MUSCLES, type TargetGroup } from '../src/lib/muscles';
import type { ExerciseListItem } from '../src/api/types';

/**
 * EXERCISE LIBRARY — the gym's own catalogue, the same rows trainers build
 * plans from. Browsing is a reference act, so this screen only reads; logging
 * happens in a session.
 */
export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  /** Selected head within `muscle` (e.g. lower_chest). null = every head. */
  const [head, setHead] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useExercises(query, muscle);
  const items = data?.exercises ?? [];

  /**
   * Heads only apply while browsing a group. A search is a direct lookup, and
   * splitting its results across headings buries the match the member typed.
   */
  const heads: TargetGroup[] | null = query ? null : groupsFor(muscle);
  const sections = useMemo(() => buildHeadSections(items, heads), [items, heads]);
  const visible = useMemo(
    () => (!sections || !head ? sections : sections.filter((x) => x.head.key === head)),
    [sections, head],
  );

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Exercises" />
      <View className="px-4 pb-3">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search the library"
          accessibilityLabel="Search exercises"
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerClassName="gap-2 px-4 pb-3"
      >
        {MUSCLES.map((m) => (
          <Chip
            key={m.label}
            label={m.label}
            active={muscle === m.value}
            onPress={() => {
              setMuscle(m.value);
              // A head belongs to one group; carrying it across a group change
              // would filter to a head that no longer exists and show nothing.
              setHead(null);
            }}
          />
        ))}
      </ScrollView>

      {sections && sections.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerClassName="gap-2 px-4 pb-3"
        >
          <Chip label="All" active={head === null} onPress={() => setHead(null)} />
          {sections
            .filter((sec) => sec.list.length > 0)
            .map((sec) => (
              <Chip
                key={sec.head.key}
                label={`${sec.head.label} ${sec.list.length}`}
                active={head === sec.head.key}
                onPress={() => setHead(head === sec.head.key ? null : sec.head.key)}
              />
            ))}
        </ScrollView>
      ) : null}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#79716b" />
        }
        contentContainerClassName="px-4 pb-28 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <Loading label="Loading library" />
        ) : items.length === 0 ? (
          <Empty
            title={query ? 'No matches' : 'No exercises yet'}
            body={
              query
                ? 'Try a different search.'
                : 'Your gym has not added its exercise catalogue yet.'
            }
          />
        ) : visible ? (
          // Grouped by head: the headings are how someone notices they have
          // been shown only upper-chest work.
          visible
            .filter((sec) => sec.list.length > 0)
            .map((sec) => (
              <View key={sec.head.key}>
                <Row className="mb-2">
                  <Label>{sec.head.label}</Label>
                  <Txt variant="caption" tone="t4">
                    {sec.list.length}
                  </Txt>
                </Row>
                <ListCard>
                  {sec.list.map((e, i) => (
                    <ExerciseRow
                      key={e.id}
                      e={e}
                      first={i === 0}
                      onPress={() => router.push(`/exercise/${e.id}`)}
                    />
                  ))}
                </ListCard>
              </View>
            ))
        ) : (
          <ListCard>
            {items.map((e, i) => (
              <ExerciseRow
                key={e.id}
                e={e}
                first={i === 0}
                onPress={() => router.push(`/exercise/${e.id}`)}
              />
            ))}
          </ListCard>
        )}
      </ScrollView>
    </View>
  );
}


/**
 * One library row. Defined once and used by both the flat list and the
 * head-grouped one, so a change to the row cannot apply to only half the screen.
 */
function ExerciseRow({
  e,
  onPress,
  first,
}: {
  e: ExerciseListItem;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <View>
      {first ? null : <View className="bg-border ml-16 h-px" />}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${e.name}. ${[e.muscleGroup, e.equipment].filter(Boolean).join(', ')}${
          e.favorited ? '. Favourite' : ''
        }`}
        className="active:bg-secondary flex-row items-center gap-3 px-3 py-2.5">
        {/* The still, not the GIF: forty animating images in a scrolling list is
            a lot of decode for no extra meaning — the animation earns its place
            on the detail screen. */}
        {e.thumbUrl ? (
          <Image
            source={{ uri: e.thumbUrl }}
            className="bg-secondary h-12 w-12 rounded-md"
            // Decorative: the name beside it already says what this is, so
            // announcing the image again would just be noise.
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          // A placeholder rather than nothing, so rows with and without media
          // keep the same text alignment down the list.
          <View className="bg-secondary h-12 w-12 items-center justify-center rounded-md">
            <Icon name="exercises" size={18} tone="t4" decorative />
          </View>
        )}
        <View className="flex-1">
          <Txt variant="body" numberOfLines={1}>
            {e.name}
          </Txt>
          <Txt variant="caption" tone="t3" numberOfLines={1}>
            {[e.muscleGroup, e.equipment].filter(Boolean).join(' · ') || 'Exercise'}
          </Txt>
        </View>
        {e.favorited ? <Icon name="star" size={15} tone="accent" filled decorative /> : null}
        <Icon name="chevron" size={16} tone="t4" decorative />
      </Pressable>
    </View>
  );
}
