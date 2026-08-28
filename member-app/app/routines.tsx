import { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Share, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Icon, Label, Row, Txt, type IconName } from '../src/ui';
import { PLACEHOLDER } from '../src/ui/Field';
import { Confirm, Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { SkeletonList } from '../src/ui/Skeleton';
import {
  useDeleteRoutine,
  useImportRoutine,
  useRoutines,
  useShareRoutine,
} from '../src/api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * MY ROUTINES
 * ────────────────────────────────────────────────────────────────
 *
 * A member's own saved workouts: personal, repeatable, and shareable by link.
 *
 * Sharing hands over a COPY, not a subscription. Someone who adds your routine
 * gets their own editable version, and your later changes never reach them —
 * which is what "add it to mine" should mean, and avoids a workout silently
 * changing under someone mid-session.
 *
 * ONE PRIMARY ACTION PER CARD. This screen used to put Start, Edit, Share and
 * Delete in one row at equal weight, so the thing a member came here to do sat
 * beside the one that destroys the routine. Start now owns the card and the
 * rest live behind a disclosure — the same four actions, ranked.
 */

/** Where a share link points. Universal-link setup is a separate deploy step,
 *  so the code is also accepted directly for anyone who cannot open the URL. */
/** Height of the pinned Create bar, above the safe area: p-4 top (16) + a
 *  size="lg" Button (h-12 = 48) + p-4 bottom (16). Named so the scroll
 *  padding that clears it cannot drift away from the bar itself. */
const CREATE_BAR_H = 80;

const SHARE_BASE =
  (process.env.EXPO_PUBLIC_PAY_BASE_URL ?? 'https://app.musclex.infynarc.com') + '/r';


export default function RoutinesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useRoutines();
  const share = useShareRoutine();
  const del = useDeleteRoutine();
  const importRoutine = useImportRoutine();

  const [code, setCode] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /** Which card has its secondary actions open. One at a time. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'error' | 'success';
    title: string;
    body?: string;
  } | null>(null);

  const routines = data?.routines ?? [];

  async function onShare(id: string, name: string) {
    setNotice(null);
    try {
      const res = await share.mutateAsync(id);
      const url = `${SHARE_BASE}/${res.token}`;
      await Share.share({ message: `${name} — my workout routine on MuscleX:\n${url}`, url });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not create a link',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  async function onImport() {
    // Accept a full link or the bare code — people paste whichever they have.
    const token = code.trim().split('/').pop()?.trim();
    if (!token) return;
    setNotice(null);
    try {
      const res = await importRoutine.mutateAsync(token);
      setCode('');
      setNotice({
        tone: 'success',
        title: `Added "${res.routine.name}"`,
        body: res.missing.length
          ? `Your gym does not have: ${res.missing.join(', ')}. Everything else was added.`
          : undefined,
      });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not add that routine',
        body: e instanceof Error ? e.message : 'Check the link and try again.',
      });
    }
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="My routines" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#79716b" />
        }
        contentContainerClassName="gap-3 px-4"
        // Clears the pinned bar so the last card can always be scrolled out
        // from under it.
        contentContainerStyle={{
          paddingBottom: (routines.length ? CREATE_BAR_H : 0) + insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled">
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {isLoading ? (
          <SkeletonList count={3} label="Loading routines" />
        ) : routines.length === 0 ? (
          <>
            <Empty
              title="No routines yet"
              body="Build one here, or finish a workout and tap Save as routine."
            />
            <Button title="Create a routine" onPress={() => router.push('/routine-edit')} />
            <Button
              title="Browse ready-made workouts"
              variant="secondary"
              onPress={() => router.push('/explore')}
            />
          </>
        ) : (
          <>
            {routines.map((r) => {
              const open = openId === r.id;
              const thumbs = r.exercises.filter((e) => e.thumbUrl).slice(0, 6);
              return (
                <Card key={r.id} className="gap-3">
                  <Row className="items-start">
                    <View className="flex-1 pr-3">
                      <Txt variant="heading">{r.name}</Txt>
                      <Txt variant="caption" tone="t3" className="mt-0.5">
                        {r.exercises.length}{' '}
                        {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                        {r.importedFromLink ? ' · added from a link' : ''}
                      </Txt>
                    </View>
                  </Row>

                  {thumbs.length ? (
                    <View className="flex-row flex-wrap gap-2">
                      {thumbs.map((e) => (
                        <Image
                          key={e.exerciseId}
                          source={{ uri: e.thumbUrl! }}
                          className="bg-secondary h-[42px] w-[42px] rounded-sm"
                          // The name is already in the card's own label; a
                          // per-thumbnail label would read the list twice.
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                      ))}
                    </View>
                  ) : null}

                  <Row className="gap-2">
                    <View className="flex-1">
                      <Button
                        title="Start"
                        size="sm"
                        accessibilityLabel={`Start ${r.name}`}
                        onPress={() => router.push(`/session?routine=${r.id}`)}
                      />
                    </View>
                    <Pressable
                      onPress={() => setOpenId(open ? null : r.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`More actions for ${r.name}`}
                      accessibilityState={{ expanded: open }}
                      className="border-border bg-secondary h-9 w-11 items-center justify-center rounded-md border active:opacity-70">
                      <Icon name="more" size={16} tone="t2" decorative />
                    </Pressable>
                  </Row>

                  {open ? (
                    <View className="border-border -mx-4 -mb-4 border-t">
                      <RoutineAction
                        icon="edit"
                        label="Edit"
                        first
                        onPress={() => router.push(`/routine-edit?id=${r.id}`)}
                      />
                      <RoutineAction
                        icon="share"
                        label="Share a copy"
                        onPress={() => onShare(r.id, r.name)}
                      />
                      <RoutineAction
                        icon="trash"
                        label="Delete"
                        danger
                        onPress={() => setConfirmId(r.id)}
                      />
                    </View>
                  ) : null}

                  {confirmId === r.id ? (
                    <Confirm
                      title={`Delete "${r.name}"?`}
                      body="Workouts you already logged from it are kept."
                      confirmLabel="Delete"
                      onCancel={() => setConfirmId(null)}
                      onConfirm={() => {
                        del.mutate(r.id);
                        setConfirmId(null);
                        setOpenId(null);
                      }}
                    />
                  ) : null}
                </Card>
              );
            })}
          </>
        )}

        <Card>
          <Label>Add someone's routine</Label>
          <Txt variant="small" tone="t2" className="mt-2">
            Paste a share link or code. You get your own copy to edit — their later changes will
            not touch it.
          </Txt>
          <Row className="mt-3 gap-2">
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              placeholder="Link or code"
              placeholderTextColor={PLACEHOLDER}
              accessibilityLabel="Routine link or code"
              className="border-border bg-secondary text-foreground h-12 flex-1 rounded-md border px-4 text-base"
            />
            <Button
              title="Add"
              size="sm"
              onPress={onImport}
              disabled={!code.trim()}
              loading={importRoutine.isPending}
            />
          </Row>
        </Card>
      </ScrollView>

      {/* Pinned rather than sitting above the list: this is the one action a
          member comes here to take that is not on a card, and at the top of a
          scrolling list it sat outside the thumb's reach on a large phone.
          Only when there ARE routines — the empty state is a single screenful
          with nothing to scroll past, and the button belongs with the words
          explaining it. */}
      {routines.length ? (
        <View
          className="border-border bg-background absolute bottom-0 left-0 right-0 border-t p-4"
          style={{ paddingBottom: insets.bottom + 16 }}>
          <Button title="Create a routine" onPress={() => router.push('/routine-edit')} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One row in a card's disclosed actions. Full-bleed to the card edge so the
 * group reads as a drawer belonging to the card rather than a list floating
 * inside it.
 */
function RoutineAction({
  icon,
  label,
  onPress,
  first,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  first?: boolean;
  danger?: boolean;
}) {
  return (
    <View>
      {first ? null : <View className="bg-border ml-12 h-px" />}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="active:bg-secondary min-h-12 flex-row items-center gap-3 px-4 py-3">
        <Icon name={icon} size={17} tone={danger ? 'accent' : 't2'} decorative />
        <Txt variant="body" tone={danger ? 'accent' : 't1'}>
          {label}
        </Txt>
      </Pressable>
    </View>
  );
}
