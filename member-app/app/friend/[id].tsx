import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { color, radius, space } from '../../src/ui/theme';
import { useUnits } from '../../src/lib/use-units';
import { useFriendPrs, useRoutines, useSendRoutineToFriend } from '../../src/api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * FRIEND — lift-for-lift comparison
 * ────────────────────────────────────────────────────────────────
 *
 * Only lifts you have BOTH recorded. A list of exercises only one of you does
 * is not a comparison, and padding it with blanks would make the screen look
 * like it had failed to load.
 *
 * Matched on exercise NAME, because exercise ids are issued per gym: comparing
 * by id across two studios would report that you have nothing in common.
 */
export default function FriendScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const u = useUnits();

  const { data, isLoading } = useFriendPrs(id ?? null);
  const { data: routines } = useRoutines();
  const send = useSendRoutineToFriend();

  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);
  const [picking, setPicking] = useState(false);

  if (isLoading) return <Loading label="Loading" />;

  const lifts = data?.lifts ?? [];
  const mineAhead = lifts.filter((l) => l.mine.weightKg > l.theirs.weightKg).length;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title={data?.name ?? 'Friend'} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {data && !data.sharing ? (
          // Said plainly, and kept distinct from "nothing in common": one is
          // their choice, the other is just a fact about your training.
          <Empty
            title="Not sharing personal records"
            body={`${data.name} has not turned on record sharing. Only they can change that.`}
          />
        ) : lifts.length === 0 ? (
          <Empty
            title="No lifts in common yet"
            body="Once you have both recorded a personal record on the same exercise, it shows up here."
          />
        ) : (
          <>
            <Card>
              <Label>Head to head</Label>
              <Txt variant="heading" style={{ marginTop: space.sm }}>
                {mineAhead} of {lifts.length}
              </Txt>
              <Txt variant="small" tone="t2">
                lifts where you are ahead
              </Txt>
            </Card>

            {lifts.map((l) => {
              const ahead = l.mine.weightKg > l.theirs.weightKg;
              const level = l.mine.weightKg === l.theirs.weightKg;
              return (
                <Card key={l.exercise}>
                  <Txt variant="body" style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                    {l.exercise}
                  </Txt>
                  <Row style={{ marginTop: space.md, gap: space.sm }}>
                    <Side
                      who="You"
                      weight={u.fw(l.mine.weightKg)}
                      reps={l.mine.reps}
                      lead={ahead && !level}
                    />
                    <Side
                      who={data?.name ?? 'Them'}
                      weight={u.fw(l.theirs.weightKg)}
                      reps={l.theirs.reps}
                      lead={!ahead && !level}
                    />
                  </Row>
                  {level ? (
                    <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
                      Dead level.
                    </Txt>
                  ) : null}
                </Card>
              );
            })}
          </>
        )}

        <Card>
          <Label>Send a routine</Label>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            They get their own copy to edit. Your later changes will not touch it.
          </Txt>
          {!picking ? (
            <View style={{ marginTop: space.md }}>
              <Button title="Choose a routine" variant="secondary" onPress={() => setPicking(true)} />
            </View>
          ) : (routines?.routines ?? []).length === 0 ? (
            <Txt variant="small" tone="t3" style={{ marginTop: space.md }}>
              You have no routines yet.
            </Txt>
          ) : (
            (routines?.routines ?? []).map((r) => (
              <Row key={r.id} style={{ marginTop: space.md }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{r.name}</Txt>
                  <Txt variant="caption" tone="t3">{r.exercises.length} exercises</Txt>
                </View>
                <Button
                  title="Send"
                  size="sm"
                  loading={send.isPending}
                  onPress={async () => {
                    try {
                      await send.mutateAsync({ appUserId: id as string, routineId: r.id });
                      setPicking(false);
                      setNotice({ tone: 'success', title: `Sent "${r.name}"` });
                    } catch (e) {
                      setNotice({
                        tone: 'error',
                        title: 'Could not send it',
                        body: e instanceof Error ? e.message : undefined,
                      });
                    }
                  }}
                />
              </Row>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function Side({
  who,
  weight,
  reps,
  lead,
}: {
  who: string;
  weight: string;
  reps: number;
  lead: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        // The heavier side is marked rather than the row being sorted: keeping
        // "You" always on the left makes a long list scannable.
        borderColor: lead ? color.accent : color.line,
        backgroundColor: lead ? color.accentSoft : 'transparent',
      }}
    >
      <Txt variant="caption" tone="t3" numberOfLines={1}>{who}</Txt>
      <Txt variant="body" style={{ fontWeight: '700', marginTop: 2 }}>{weight}</Txt>
      <Txt variant="caption" tone="t3">× {reps}</Txt>
    </View>
  );
}
