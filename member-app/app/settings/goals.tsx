import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Meter, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { font, color, radius, space } from '../../src/ui/theme';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { useAddGoal, useGoals, useUpdateGoal } from '../../src/api/queries';

const TYPES = [
  { key: 'weight', label: 'Body weight', unit: 'kg' },
  { key: 'workouts', label: 'Workouts', unit: 'sessions' },
  { key: 'steps', label: 'Steps', unit: 'steps' },
  { key: 'water', label: 'Water', unit: 'ml' },
] as const;

/** Member-set goals. Progress is server-tracked; this screen sets and closes them. */
export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useGoals();
  const add = useAddGoal();
  const update = useUpdateGoal();

  const [type, setType] = useState<string>('weight');
  const [target, setTarget] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading goals" />;

  const goals = data?.goals ?? [];
  const active = goals.filter((g) => g.status === 'active');
  const closed = goals.filter((g) => g.status !== 'active');
  const chosen = TYPES.find((t) => t.key === type)!;

  async function create() {
    const value = Number(target);
    if (!value) return;
    setNotice(null);
    try {
      await add.mutateAsync({
        type,
        title: `${chosen.label} goal`,
        targetValue: value,
        unit: chosen.unit,
      });
      setTarget('');
      setNotice({ tone: 'success', title: 'Goal set' });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not set goal',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Goals" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Set a goal</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
            {TYPES.map((t) => {
              const on = type === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setType(t.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    height: 34,
                    paddingHorizontal: space.lg,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? color.accentSoft : color.surface2,
                    borderWidth: 1,
                    borderColor: on ? color.accentEdge : color.line,
                  }}
                >
                  <Txt variant="caption" tone={on ? 'accent' : 't2'} style={{ fontWeight: '600' }}>
                    {t.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Row style={{ marginTop: space.md, gap: space.sm }}>
            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="decimal-pad"
              placeholder={`Target in ${chosen.unit}`}
              placeholderTextColor={color.t4}
              accessibilityLabel="Goal target"
              style={{
                flex: 1,
                height: 46,
                borderRadius: radius.md,
                backgroundColor: color.surface2,
                borderWidth: 1,
                borderColor: color.line,
                color: color.t1,
                paddingHorizontal: space.lg,
                fontFamily: font,
                fontSize: 16,
              }}
            />
            <Button title="Add" size="sm" onPress={create} disabled={!target} loading={add.isPending} />
          </Row>
        </Card>

        <Card>
          <Label>Active</Label>
          {active.length === 0 ? (
            <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
              No goals set. Pick one above.
            </Txt>
          ) : (
            active.map((g) => (
              <View key={g.id} style={{ marginTop: space.lg }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <Txt variant="bodyStrong">{g.title}</Txt>
                    <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                      {g.currentValue ?? 0} / {g.targetValue} {g.unit}
                    </Txt>
                  </View>
                  <Button
                    title="Done"
                    variant="secondary"
                    size="sm"
                    loading={update.isPending}
                    onPress={() => update.mutate({ id: g.id, status: 'completed' })}
                  />
                </Row>
                {g.targetValue ? (
                  <Meter value={g.currentValue ?? 0} max={g.targetValue} tint={color.accent} />
                ) : null}
              </View>
            ))
          )}
        </Card>

        {closed.length ? (
          <Card>
            <Label>Completed</Label>
            {closed.map((g) => (
              <Row key={g.id} style={{ marginTop: space.md, opacity: 0.6 }}>
                <Txt variant="body">{g.title}</Txt>
                <Txt variant="caption" tone="good">✓ {g.status}</Txt>
              </Row>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
