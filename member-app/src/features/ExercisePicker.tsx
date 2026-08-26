import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Icon, Label, Loading, Row, Txt } from '../ui';
import { Notice } from '../ui/Notice';
import { Chip } from '../ui/Chip';
import { color, font, radius, space } from '../ui/theme';
import {
  useCreateCustomExercise,
  useExerciseDetail,
  useExercises,
  useToggleFavorite,
} from '../api/queries';
import { buildHeadSections, groupsFor, MUSCLES, targetLabel, type TargetGroup } from '../lib/muscles';
import type { ExerciseListItem } from '../api/types';

/**
 * ────────────────────────────────────────────────────────────────
 * EXERCISE PICKER
 * ────────────────────────────────────────────────────────────────
 *
 * Adding exercises is the step between deciding to train and actually
 * training, so it has to be fast at the size a real gym catalogue reaches.
 *
 * What that means concretely:
 *   - filter by MUSCLE, because people plan by body part, not alphabetically
 *   - a FAVOURITES shelf, because most people rotate the same dozen lifts
 *   - MULTI-SELECT, because a session is 4-6 exercises and closing the sheet
 *     after each one turns adding a workout into six round trips
 *   - favourite inline, so curating that shelf never costs you your place
 *
 * The muscle and favourites filters are server-side (`/exercises?muscle=&
 * favorites=`), so this stays correct as a catalogue grows past what is
 * sensible to hold in memory.
 */


function ExerciseRow({
  item,
  selected,
  onToggle,
  onInfo,
}: {
  item: ExerciseListItem;
  selected: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  const fav = useToggleFavorite(item.id);
  const subtitle =
    [item.targetMuscle ? targetLabel(item.targetMuscle) : item.muscleGroup, item.equipment]
      .filter(Boolean)
      .join(' · ') || 'Exercise';

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${item.name}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: selected ? color.accentEdge : color.line,
        backgroundColor: selected ? color.accentSoft : color.surface,
      }}
    >
      {/* The light still, never the GIF: forty animated GIFs in a scrolling
          list would pull megabytes to render 40px thumbnails. */}
      {item.thumbUrl || item.mediaUrl ? (
        <Image
          source={{ uri: item.thumbUrl ?? item.mediaUrl! }}
          style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color.surface2 }}
          accessibilityLabel=""
        />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.sm,
            backgroundColor: color.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="gym" size={18} tone="t4" decorative />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{item.name}</Txt>
        <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
          {subtitle}
          {item.isCustom ? ' · yours' : ''}
        </Txt>
      </View>

      {/* Form cues without leaving the picker: deciding whether an exercise is
          the one you meant is part of choosing it. */}
      {item.hasInstructions ? (
        <Pressable
          onPress={onInfo}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`How to do ${item.name}`}
        >
          <Icon name="alert" size={17} tone="t3" decorative />
        </Pressable>
      ) : null}

      {/* Curating favourites must not cost you your place in the list. */}
      <Pressable
        onPress={() => fav.mutate(!item.favorited)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={item.favorited ? `Unfavourite ${item.name}` : `Favourite ${item.name}`}
      >
        <Icon
          name="star"
          size={19}
          tone={item.favorited ? 'accent' : 't3'}
          filled={item.favorited}
          decorative
        />
      </Pressable>

      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? color.accent : 'transparent',
          borderWidth: selected ? 0 : 1.5,
          borderColor: color.lineStrong,
        }}
      >
        {selected ? <Icon name="check" size={14} tone="inverse" decorative /> : null}
      </View>
    </Pressable>
  );
}

export function ExercisePicker({
  visible,
  alreadyAdded,
  onClose,
  onAdd,
}: {
  visible: boolean;
  /** Exercise ids already in the session, shown as locked-in. */
  alreadyAdded: string[];
  onClose: () => void;
  onAdd: (items: ExerciseListItem[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  /** Selected head within `muscle` (e.g. lower_chest). null = show every head. */
  const [head, setHead] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [picked, setPicked] = useState<Record<string, ExerciseListItem>>({});
  const [infoId, setInfoId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTimed, setNewTimed] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createCustom = useCreateCustomExercise();
  const { data: detail } = useExerciseDetail(infoId);

  const { data, isLoading } = useExercises(query, muscle, favoritesOnly);
  const items = data?.exercises ?? [];
  const inSession = useMemo(() => new Set(alreadyAdded), [alreadyAdded]);
  const pickedList = Object.values(picked);

  /**
   * When a muscle group has distinct heads, show them as sections rather than
   * one list. Picking "Shoulders" and scrolling an alphabetical list is how
   * people end up with three front-delt exercises and no rear delt work.
   *
   * Only applied when a group is selected and not searching — a search is a
   * direct lookup, and sectioning it would bury the match.
   */
  const heads: TargetGroup[] | null =
    !query && !favoritesOnly ? groupsFor(muscle) : null;

  const sections = useMemo(() => buildHeadSections(items, heads), [heads, items]);

  /**
   * Narrow to one head when the member picks a chip. Without this a group like
   * Chest renders upper -> mid -> lower in order, so reaching a decline press
   * means scrolling past every incline and flat variation first.
   *
   * Filtering the SECTIONS rather than re-querying keeps the head labels and
   * their "covered" ticks intact, so the coverage summary below still counts
   * every head rather than only the visible one.
   */
  const visibleSections = useMemo(
    () => (!sections || !head ? sections : sections.filter((s) => s.head.key === head)),
    [sections, head],
  );

  /** Which heads the current selection already covers — the point of the split. */
  const covered = useMemo(() => {
    const set = new Set<string>();
    for (const e of pickedList) if (e.targetMuscle) set.add(e.targetMuscle);
    for (const id of alreadyAdded) {
      const found = items.find((e) => e.id === id);
      if (found?.targetMuscle) set.add(found.targetMuscle);
    }
    return set;
  }, [pickedList, alreadyAdded, items]);

  function toggle(item: ExerciseListItem) {
    if (inSession.has(item.id)) return;
    Haptics.selectionAsync().catch(() => {});
    setPicked((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }

  function confirm() {
    onAdd(pickedList);
    setPicked({});
    setQuery('');
    setMuscle(null);
    setFavoritesOnly(false);
  }

  function dismiss() {
    setPicked({});
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: color.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderTopWidth: 1,
            borderColor: color.line,
            paddingTop: space.lg,
            height: '88%',
          }}
        >
          <Row style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
            <Txt variant="heading">Add exercises</Txt>
            <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Txt variant="small" tone="t2">Close</Txt>
            </Pressable>
          </Row>

          <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your gym's library"
              placeholderTextColor={color.t4}
              accessibilityLabel="Search exercises"
              style={{
                height: 46,
                borderRadius: radius.md,
                backgroundColor: color.surface2,
                borderWidth: 1,
                borderColor: color.line,
                color: color.t1,
                paddingHorizontal: space.lg,
                fontFamily: font,
                fontSize: 15,
              }}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}
            >
              <Chip
                label="Favourites"
                icon="star"
                active={favoritesOnly}
                onPress={() => setFavoritesOnly((v) => !v)}
              />
              {MUSCLES.map((m) => (
                <Chip
                  key={m.label}
                  label={m.label}
                  active={muscle === m.value && !(m.value === null && favoritesOnly)}
                  onPress={() => {
                    setMuscle(m.value);
                    // A head belongs to one group; keeping it across a group
                    // change would filter to a head that no longer exists and
                    // show an empty list.
                    setHead(null);
                  }}
                />
              ))}
            </ScrollView>

            {sections && sections.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}
              >
                <Chip label="All" active={head === null} onPress={() => setHead(null)} />
                {sections
                  .filter((sec) => sec.list.length > 0)
                  .map((sec) => (
                    <Chip
                      key={sec.head.key}
                      // The tick repeats the section heading so the member can
                      // see what is already covered without clearing the filter.
                      label={`${sec.head.label} ${sec.list.length}`}
                      done={covered.has(sec.head.key)}
                      active={head === sec.head.key}
                      onPress={() => setHead(head === sec.head.key ? null : sec.head.key)}
                    />
                  ))}
              </ScrollView>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: space.xl }}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <Loading label="Loading library" />
            ) : items.length === 0 ? (
              <Empty
                title={favoritesOnly ? 'No favourites yet' : 'No exercises match'}
                body={
                  favoritesOnly
                    ? 'Tap the star on any exercise to keep it here.'
                    : 'Try a different search or muscle group.'
                }
              />
            ) : visibleSections ? (
              visibleSections
                .filter((sec) => sec.list.length > 0)
                .map((sec) => (
                  <View key={sec.head.key} style={{ gap: space.sm, marginBottom: space.md }}>
                    <Row style={{ marginTop: space.sm }}>
                      <View style={{ flex: 1 }}>
                        <Row style={{ justifyContent: 'flex-start', gap: space.sm }}>
                          <Txt variant="label" tone="t3">{sec.head.label}</Txt>
                          {covered.has(sec.head.key) ? (
                            <Row style={{ gap: 4, justifyContent: 'flex-start' }}>
                              <Icon name="check" size={12} tone="good" decorative />
                              <Txt variant="caption" tone="good" style={{ fontWeight: '700' }}>
                                covered
                              </Txt>
                            </Row>
                          ) : null}
                        </Row>
                        <Txt variant="caption" tone="t4" style={{ marginTop: 2 }}>
                          {sec.head.hint}
                        </Txt>
                      </View>
                    </Row>
                    {sec.list.map((e) =>
                      inSession.has(e.id) ? (
                        <View key={e.id} style={{ opacity: 0.45 }}>
                          <Card>
                            <Row>
                              <Txt variant="bodyStrong">{e.name}</Txt>
                              <Txt variant="caption" tone="t3">Already added</Txt>
                            </Row>
                          </Card>
                        </View>
                      ) : (
                        <ExerciseRow
                          key={e.id}
                          item={e}
                          selected={!!picked[e.id]}
                          onToggle={() => toggle(e)}
                          onInfo={() => setInfoId(e.id)}
                        />
                      ),
                    )}
                  </View>
                ))
            ) : (
              items.map((e) =>
                inSession.has(e.id) ? (
                  <View key={e.id} style={{ opacity: 0.45 }}>
                    <Card>
                      <Row>
                        <Txt variant="bodyStrong">{e.name}</Txt>
                        <Txt variant="caption" tone="t3">Already added</Txt>
                      </Row>
                    </Card>
                  </View>
                ) : (
                  <ExerciseRow
                    key={e.id}
                    item={e}
                    selected={!!picked[e.id]}
                    onToggle={() => toggle(e)}
                    onInfo={() => setInfoId(e.id)}
                  />
                ),
              )
            )}
            {/* Adding a movement the gym has not catalogued. It stays PERSONAL —
              members do not write into the shared library every other member
              and trainer sees. */}
          {creating ? (
            <Card>
              <Label>New exercise</Label>
              {createError ? (
                <View style={{ marginTop: space.sm }}>
                  <Notice title="Could not add it" body={createError}
                    onDismiss={() => setCreateError(null)} />
                </View>
              ) : null}
              <TextInput
                value={newName}
                onChangeText={setNewName}
                autoFocus
                placeholder="Exercise name"
                placeholderTextColor={color.t4}
                accessibilityLabel="New exercise name"
                style={{
                  height: 46,
                  marginTop: space.md,
                  borderRadius: radius.md,
                  backgroundColor: color.surface2,
                  borderWidth: 1,
                  borderColor: color.line,
                  color: color.t1,
                  paddingHorizontal: space.lg,
                  fontFamily: font,
                  fontSize: 15,
                }}
              />
              <Row style={{ marginTop: space.md }}>
                <Txt variant="small" tone="t2">Tracked by time, not reps</Txt>
                <Pressable
                  onPress={() => setNewTimed((v) => !v)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: newTimed }}
                  accessibilityLabel="Track by time"
                  style={{
                    width: 46,
                    height: 28,
                    borderRadius: radius.pill,
                    padding: 3,
                    backgroundColor: newTimed ? color.accent : color.surface2,
                    borderWidth: 1,
                    borderColor: newTimed ? color.accent : color.line,
                    alignItems: newTimed ? 'flex-end' : 'flex-start',
                  }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color.surface }} />
                </Pressable>
              </Row>
              <Row style={{ marginTop: space.lg, gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button title="Cancel" variant="secondary"
                    onPress={() => { setCreating(false); setNewName(''); setCreateError(null); }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Add"
                    loading={createCustom.isPending}
                    disabled={!newName.trim()}
                    onPress={async () => {
                      setCreateError(null);
                      try {
                        const made = await createCustom.mutateAsync({
                          name: newName.trim(),
                          // Inherit the filter the member is standing in, so an
                          // exercise created while browsing Shoulders is filed
                          // there rather than landing uncategorised.
                          ...(muscle ? { muscleGroup: muscle } : {}),
                          trackingType: newTimed ? 'duration' : 'reps',
                        });
                        // Straight into the session — creating it was already
                        // the decision to use it. trackingType MUST travel with
                        // it: without it the session defaults to reps and a
                        // just-created timed exercise renders weight/reps
                        // columns, silently discarding the choice.
                        onAdd([
                          {
                            id: made.id,
                            name: made.name,
                            isCustom: true,
                            trackingType: newTimed ? 'duration' : 'reps',
                            ...(muscle ? { muscleGroup: muscle } : {}),
                          },
                        ]);
                        setCreating(false);
                        setNewName('');
                      } catch (e) {
                        setCreateError(e instanceof Error ? e.message : 'Please try again.');
                      }
                    }}
                  />
                </View>
              </Row>
            </Card>
          ) : (
            <Button
              title="+ Create an exercise"
              variant="quiet"
              onPress={() => setCreating(true)}
            />
          )}
        </ScrollView>

          <View
            style={{
              padding: space.lg,
              paddingBottom: insets.bottom + space.lg,
              borderTopWidth: 1,
              borderTopColor: color.line,
              backgroundColor: color.surface,
            }}
          >
            {heads ? (
              <Txt variant="caption" tone="t3" style={{ marginBottom: space.sm, textAlign: 'center' }}>
                {covered.size === heads.length
                  ? `All ${heads.length} heads covered — that is a complete ${muscle} session.`
                  : `${covered.size} of ${heads.length} covered · missing ${heads
                      .filter((h) => !covered.has(h.key))
                      .map((h) => h.label.toLowerCase())
                      .join(', ')}`}
              </Txt>
            ) : null}

            <Button
              title={
                pickedList.length === 0
                  ? 'Select exercises to add'
                  : `Add ${pickedList.length} exercise${pickedList.length > 1 ? 's' : ''}`
              }
              onPress={confirm}
              disabled={pickedList.length === 0}
            />
          </View>
        </View>
      </View>

      {/* Instructions, over the picker rather than replacing it, so reading how
          to do a lift never costs you the selection you were building. */}
      <Modal
        visible={!!infoId}
        animationType="fade"
        transparent
        onRequestClose={() => setInfoId(null)}
      >
        <View style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: color.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: space.lg,
              paddingBottom: insets.bottom + space.lg,
              maxHeight: '70%',
            }}
          >
            <Row style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
              <View style={{ flex: 1, paddingRight: space.md }}>
                <Txt variant="heading">{detail?.name ?? 'Exercise'}</Txt>
                <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                  {[detail?.muscleGroup, detail?.equipment].filter(Boolean).join(' · ')}
                </Txt>
              </View>
              <Pressable
                onPress={() => setInfoId(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close instructions"
              >
                <Txt variant="small" tone="t2">Close</Txt>
              </Pressable>
            </Row>
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg }}>
              {detail?.mediaUrl ? (
                <Image
                  source={{ uri: detail.mediaUrl }}
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: radius.lg,
                    backgroundColor: color.surface2,
                    marginBottom: space.lg,
                  }}
                  resizeMode="contain"
                  accessibilityLabel={`${detail.name} demonstration`}
                />
              ) : null}
              <Txt variant="body" tone="t2" style={{ lineHeight: 23 }}>
                {detail?.instructions ?? 'No instructions recorded for this exercise.'}
              </Txt>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
