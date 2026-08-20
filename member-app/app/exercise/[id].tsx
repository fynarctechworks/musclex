import { Image, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Label, Loading, Row, Txt } from '../../src/ui';
import { color, radius, space } from '../../src/ui/theme';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { BarChart } from '../../src/features/Sparkline';
import { shortDate } from '../../src/lib/datetime';
import { useExerciseDetail, useExerciseHistory, useToggleFavorite } from '../../src/api/queries';
import { useUnits } from '../../src/lib/use-units';

/**
 * EXERCISE DETAIL — form cues plus this member's own record on the lift.
 *
 * The history chart is heaviest-set-per-session rather than total volume:
 * members judge progress on "am I lifting more", and volume hides that behind
 * how many sets they happened to do.
 */
export default function ExerciseDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ex, isLoading } = useExerciseDetail(id ?? null);
  const { data: history } = useExerciseHistory(id ?? null);
  const fav = useToggleFavorite(id ?? '');
  const u = useUnits();

  if (isLoading || !ex) return <Loading label="Loading exercise" />;

  const sessions = history?.sessions ?? [];
  const chart = [...sessions]
    .reverse()
    .slice(-8)
    .map((s) => ({
      label: shortDate(s.loggedAt),
      value: Number(u.w(Math.max(0, ...s.sets.map((x) => x.weight)))),
    }));

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title={ex.name} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Txt variant="caption" tone="t3">
                {[ex.muscleGroup, ex.equipment].filter(Boolean).join(' · ') || 'Exercise'}
              </Txt>
              {history?.personalRecord ? (
                <Txt variant="display" style={{ marginTop: space.sm }}>
                  {u.fw(history.personalRecord.weight)}
                </Txt>
              ) : (
                <Txt variant="heading" tone="t2" style={{ marginTop: space.sm }}>
                  No record yet
                </Txt>
              )}
              {history?.personalRecord ? (
                <Txt variant="caption" tone="t3">
                  best · {history.personalRecord.reps} reps ·{' '}
                  {shortDate(history.personalRecord.achievedAt)}
                </Txt>
              ) : null}
            </View>
            <Pressable
              onPress={() => fav.mutate(!ex.favorited)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={ex.favorited ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Txt style={{ fontSize: 22, color: ex.favorited ? color.accent : color.t4 }}>
                {ex.favorited ? '★' : '☆'}
              </Txt>
            </Pressable>
          </Row>
        </Card>

        {/* The animation IS the form cue — a still of a mid-rep position tells
            you far less than watching the path. It sits above the instructions
            because most people copy the movement and never read the text. */}
        {ex.mediaUrl ? (
          <Card>
            <Image
              source={{ uri: ex.mediaUrl }}
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: radius.md,
                backgroundColor: color.surface2,
              }}
              resizeMode="contain"
              accessibilityLabel={`Animation showing how to perform ${ex.name}`}
            />
          </Card>
        ) : null}

        {chart.length > 1 ? (
          <Card>
            <Label>Heaviest set</Label>
            <View style={{ marginTop: space.md }}>
              <BarChart data={chart} />
            </View>
          </Card>
        ) : null}

        {ex.instructions ? (
          <Card>
            <Label>How to do it</Label>
            <Txt variant="body" tone="t2" style={{ marginTop: space.sm, lineHeight: 22 }}>
              {ex.instructions}
            </Txt>
          </Card>
        ) : null}

        <Card>
          <Label>Recent sessions</Label>
          {sessions.length === 0 ? (
            <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
              You have not logged this lift yet.
            </Txt>
          ) : (
            sessions.map((s) => (
              <View key={s.loggedAt} style={{ marginTop: space.md }}>
                <Txt variant="caption" tone="t3">{shortDate(s.loggedAt)}</Txt>
                <Txt variant="body" style={{ marginTop: 2 }}>
                  {s.sets.map((x) => `${u.fwc(x.weight)} × ${x.reps}`).join('  ·  ')}
                </Txt>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
