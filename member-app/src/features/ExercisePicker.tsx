import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Icon, Label, Loading, Row, Txt } from '../ui';
import { Notice } from '../ui/Notice';
import { Chip } from '../ui/Chip';
import { cn } from '@/lib/utils';
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

/* Raw colours for the props that are not classes: RN's placeholderTextColor,
   and the scrim behind the sheets. Values are the --color-* tokens. */
const PLACEHOLDER = '#a6a09b';
const SCRIM = 'rgba(12,10,9,0.35)';

/** Both sheets are bottom sheets with the same corner treatment. */
const SHEET = 'bg-background rounded-t-xl';

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
      className={cn(
        'flex-row items-center gap-3 rounded-lg border p-3 active:opacity-80',
        selected ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
      )}>
      {/* The light still, never the GIF: forty animated GIFs in a scrolling
          list would pull megabytes to render 40px thumbnails. */}
      {item.thumbUrl || item.mediaUrl ? (
        <Image
          source={{ uri: item.thumbUrl ?? item.mediaUrl! }}
          className="bg-secondary h-10 w-10 rounded-sm"
          accessibilityLabel=""
        />
      ) : (
        <View className="bg-secondary h-10 w-10 items-center justify-center rounded-sm">
          <Icon name="gym" size={18} tone="t4" decorative />
        </View>
      )}

      <View className="flex-1">
        <Txt variant="bodyStrong">{item.name}</Txt>
        <Txt variant="caption" tone="t3" className="mt-0.5">
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
        className={cn(
          'h-[26px] w-[26px] items-center justify-center rounded-full',
          selected ? 'bg-primary' : 'border-[1.5px] border-ink-4',
        )}>
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
      <View className="flex-1 justify-end" style={{ backgroundColor: SCRIM }}>
        <View className={cn(SHEET, 'border-border h-[88%] border-t pt-4')}>
          <Row className="mb-3 px-4">
            <Txt variant="heading">Add exercises</Txt>
            <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Txt variant="small" tone="t2">Close</Txt>
            </Pressable>
          </Row>

          <View className="gap-3 px-4">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your gym's library"
              placeholderTextColor={PLACEHOLDER}
              accessibilityLabel="Search exercises"
              className="border-border bg-secondary text-foreground h-12 rounded-md border px-4 text-base"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pr-4"
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
                contentContainerClassName="gap-2 pr-4"
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
            contentContainerClassName="gap-2 p-4 pb-8"
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
                  <View key={sec.head.key} className="mb-3 gap-2">
                    <Row className="mt-2">
                      <View className="flex-1">
                        <Row className="justify-start gap-2">
                          <Txt variant="label" tone="t3">
                            {sec.head.label}
                          </Txt>
                          {covered.has(sec.head.key) ? (
                            <Row className="justify-start gap-1">
                              <Icon name="check" size={12} tone="good" decorative />
                              <Txt variant="caption" tone="good" className="font-semibold">
                                covered
                              </Txt>
                            </Row>
                          ) : null}
                        </Row>
                        <Txt variant="caption" tone="t4" className="mt-0.5">
                          {sec.head.hint}
                        </Txt>
                      </View>
                    </Row>
                    {sec.list.map((e) =>
                      inSession.has(e.id) ? (
                        <View key={e.id} className="opacity-45">
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
                  <View key={e.id} className="opacity-45">
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
                <View className="mt-2">
                  <Notice title="Could not add it" body={createError}
                    onDismiss={() => setCreateError(null)} />
                </View>
              ) : null}
              <TextInput
                value={newName}
                onChangeText={setNewName}
                autoFocus
                placeholder="Exercise name"
                placeholderTextColor={PLACEHOLDER}
                accessibilityLabel="New exercise name"
                className="border-border bg-secondary text-foreground mt-3 h-12 rounded-md border px-4 text-base"
              />
              <Row className="mt-3">
                <Txt variant="small" tone="t2">
                  Tracked by time, not reps
                </Txt>
                <Pressable
                  onPress={() => setNewTimed((v) => !v)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: newTimed }}
                  accessibilityLabel="Track by time"
                  className={cn(
                    'h-7 w-[46px] rounded-full border p-[3px]',
                    newTimed
                      ? 'border-primary bg-primary items-end'
                      : 'border-border bg-secondary items-start',
                  )}>
                  <View className="bg-card h-5 w-5 rounded-full" />
                </Pressable>
              </Row>
              <Row className="mt-4 gap-2">
                <View className="flex-1">
                  <Button title="Cancel" variant="secondary"
                    onPress={() => { setCreating(false); setNewName(''); setCreateError(null); }} />
                </View>
                <View className="flex-1">
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
            className="border-border bg-card border-t p-4"
            style={{ paddingBottom: insets.bottom + 16 }}>
            {heads ? (
              <Txt variant="caption" tone="t3" className="mb-2 text-center">
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
        <View className="flex-1 justify-end" style={{ backgroundColor: SCRIM }}>
          <View
            className={cn(SHEET, 'max-h-[70%] pt-4')}
            style={{ paddingBottom: insets.bottom + 16 }}>
            <Row className="mb-3 px-4">
              <View className="flex-1 pr-3">
                <Txt variant="heading">{detail?.name ?? 'Exercise'}</Txt>
                <Txt variant="caption" tone="t3" className="mt-0.5">
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
            <ScrollView contentContainerClassName="px-4">
              {detail?.mediaUrl ? (
                <Image
                  source={{ uri: detail.mediaUrl }}
                  className="bg-secondary mb-4 h-[180px] w-full rounded-lg"
                  resizeMode="contain"
                  accessibilityLabel={`${detail.name} demonstration`}
                />
              ) : null}
              <Txt variant="body" tone="t2" className="leading-relaxed">
                {detail?.instructions ?? 'No instructions recorded for this exercise.'}
              </Txt>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
