import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Meter, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { Chip } from '../../src/ui/Chip';
import { chart } from '../../src/ui/chart-colors';
import { Field } from '../../src/ui/Field';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { useAddGoal, useGoals, useUpdateGoal } from '../../src/api/queries';
import { Icon } from '../../src/ui/Icon';

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
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Goals" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Set a goal</Label>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip
                key={t.key}
                label={t.label}
                active={type === t.key}
                onPress={() => setType(t.key)}
              />
            ))}
          </View>
          <Row className="mt-3 gap-2">
            <Field
              value={target}
              onChangeText={setTarget}
              keyboardType="decimal-pad"
              placeholder={`Target in ${chosen.unit}`}
              accessibilityLabel="Goal target"
            className="flex-1" />
            <Button title="Add" size="sm" onPress={create} disabled={!target} loading={add.isPending} />
          </Row>
        </Card>

        <Card>
          <Label>Active</Label>
          {active.length === 0 ? (
            <Txt variant="small" tone="t2" className="mt-3">
              No goals set. Pick one above.
            </Txt>
          ) : (
            active.map((g) => (
              <View key={g.id} className="mt-4">
                <Row className="items-start">
                  <View className="flex-1 pr-3">
                    <Txt variant="bodyStrong">{g.title}</Txt>
                    <Txt variant="caption" tone="t3" className="mt-0.5">
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
                  <Meter value={g.currentValue ?? 0} max={g.targetValue} tint={chart.accent} />
                ) : null}
              </View>
            ))
          )}
        </Card>

        {closed.length ? (
          <Card>
            <Label>Completed</Label>
            {closed.map((g) => (
              <Row key={g.id} className="mt-3 opacity-60">
                <Txt variant="body">{g.title}</Txt>
                <Row style={{ gap: 4, justifyContent: 'flex-start' }}>
                  <Icon name="check" size={13} tone="good" decorative />
                  <Txt variant="caption" tone="good">{g.status}</Txt>
                </Row>
              </Row>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
