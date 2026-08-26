import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { font, color, radius, space } from '../src/ui/theme';
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

  const { data, isLoading } = useExercises(query, muscle);
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
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Exercises" />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search the library"
          placeholderTextColor={color.t4}
          accessibilityLabel="Search exercises"
          style={{
            height: 46,
            borderRadius: radius.md,
            backgroundColor: color.surface,
            borderWidth: 1,
            borderColor: color.line,
            color: color.t1,
            paddingHorizontal: space.lg,
            fontFamily: font,
            fontSize: 15,
          }}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md }}
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
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md }}
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
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.sm }}
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
              <View key={sec.head.key} style={{ gap: space.sm }}>
                <View style={{ marginTop: space.sm }}>
                  <Label>{sec.head.label}</Label>
                </View>
                {sec.list.map((e) => (
                  <ExerciseRow key={e.id} e={e} onPress={() => router.push(`/exercise/${e.id}`)} />
                ))}
              </View>
            ))
        ) : (
          items.map((e) => (
            <ExerciseRow key={e.id} e={e} onPress={() => router.push(`/exercise/${e.id}`)} />
          ))
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
}: {
  e: ExerciseListItem;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${e.name}`}>
      <Card>
        <Row>
          {/* The still, not the GIF: forty animating images in a scrolling list
              is a lot of decode for no extra meaning — the animation earns its
              place on the detail screen. */}
          {e.thumbUrl ? (
            <Image
              source={{ uri: e.thumbUrl }}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.sm,
                backgroundColor: color.surface2,
                marginRight: space.md,
              }}
              // Decorative: the name beside it already says what this is, so
              // announcing the image again would just be noise.
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Txt variant="bodyStrong">{e.name}</Txt>
            <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
              {[e.muscleGroup, e.equipment].filter(Boolean).join(' · ') || 'Exercise'}
            </Txt>
          </View>
          {e.favorited ? (
            <Icon name="star" size={16} tone="accent" filled accessibilityLabel="Favourite" />
          ) : null}
          <View style={{ marginLeft: space.sm }}>
            <Icon name="chevron" size={16} tone="t4" decorative />
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}
