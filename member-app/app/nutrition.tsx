import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Meter, Row, Txt } from '../src/ui';
import { font, color, radius, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Notice } from '../src/ui/Notice';
import { useFoods, useLogMeal, useLogWater, useNutrition, useSetNutritionGoal } from '../src/api/queries';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** A macro column with its own meter, so over/under reads at a glance. */
function Macro({ label, value, goal, tint }: { label: string; value: number; goal: number; tint: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="bodyStrong">{Math.round(value)}g</Txt>
      <Txt variant="caption" tone="t3">{label} · {goal}g</Txt>
      <Meter value={value} max={goal} tint={tint} />
    </View>
  );
}

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useNutrition();
  const water = useLogWater();
  const meal = useLogMeal();

  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState<string>('breakfast');
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const { data: foodResults } = useFoods(name);
  const setGoal = useSetNutritionGoal();
  const [editingGoal, setEditingGoal] = useState(false);
  const [gKcal, setGKcal] = useState('');
  const [gProtein, setGProtein] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading || !data) return <Loading label="Loading nutrition" />;

  const { goal, totals } = data;

  async function addMeal() {
    if (!name.trim()) return;
    try {
      const { queued } = await meal.mutateAsync({
        mealType,
        items: [{ name: name.trim(), kcal: Number(kcal) || 0 }],
      });
      setOpen(false);
      setName('');
      setKcal('');
      setNotice(
        queued
          ? { tone: 'success', title: 'Saved offline', body: 'This meal will sync when you have signal.' }
          : null,
      );
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not log meal',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  const input = {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    color: color.t1,
    paddingHorizontal: space.lg,
    fontFamily: font,
    fontSize: 16,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Nutrition" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        {notice ? (
          <Notice {...notice} onDismiss={() => setNotice(null)} />
        ) : null}

        <Card>
          <Row>
            <Label>Calories</Label>
            <Button
              title={editingGoal ? 'Cancel' : 'Edit targets'}
              variant="secondary"
              size="sm"
              onPress={() => {
                setGKcal(String(goal.kcal));
                setGProtein(String(goal.proteinG));
                setEditingGoal((v) => !v);
              }}
            />
          </Row>
          <Row style={{ alignItems: 'baseline', marginTop: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
              <Txt variant="display">{Math.round(totals.kcal)}</Txt>
              <Txt variant="small" tone="t2">/ {goal.kcal} kcal</Txt>
            </View>
            <Txt variant="small" tone={totals.kcal > goal.kcal ? 'accent' : 't2'}>
              {Math.max(0, goal.kcal - Math.round(totals.kcal))} left
            </Txt>
          </Row>
          <Meter value={totals.kcal} max={goal.kcal} tint={color.accent} />
          {editingGoal ? (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <Txt variant="caption" tone="t3">Daily calories</Txt>
              <TextInput value={gKcal} onChangeText={setGKcal} keyboardType="number-pad"
                accessibilityLabel="Calorie target" placeholderTextColor={color.t4} style={input} />
              <Txt variant="caption" tone="t3">Protein (g)</Txt>
              <TextInput value={gProtein} onChangeText={setGProtein} keyboardType="number-pad"
                accessibilityLabel="Protein target" placeholderTextColor={color.t4} style={input} />
              <Button
                title="Save targets"
                loading={setGoal.isPending}
                onPress={async () => {
                  try {
                    await setGoal.mutateAsync({
                      kcal: Number(gKcal) || goal.kcal,
                      proteinG: Number(gProtein) || goal.proteinG,
                    });
                    setEditingGoal(false);
                    setNotice({ tone: 'success', title: 'Targets updated' });
                  } catch (e) {
                    setNotice({
                      tone: 'error',
                      title: 'Could not update targets',
                      body: e instanceof Error ? e.message : 'Try again.',
                    });
                  }
                }}
              />
            </View>
          ) : null}

          <Row style={{ marginTop: space.lg, gap: space.md }}>
            <Macro label="Protein" value={totals.proteinG} goal={goal.proteinG} tint={color.protein} />
            <Macro label="Carbs" value={totals.carbsG} goal={goal.carbsG} tint={color.carbs} />
            <Macro label="Fat" value={totals.fatG} goal={goal.fatG} tint={color.fat} />
          </Row>
        </Card>

        <Card>
          <Row>
            <Label>Water</Label>
            <Button
              title="+250ml"
              variant="secondary"
              size="sm"
              loading={water.isPending}
              onPress={() => water.mutate(250)}
            />
          </Row>
          <Row style={{ alignItems: 'baseline', marginTop: space.sm }}>
            <Txt variant="heading">{(data.waterMl / 1000).toFixed(1)}L</Txt>
            <Txt variant="small" tone="t2">/ {(goal.waterMl / 1000).toFixed(1)}L</Txt>
          </Row>
          <Meter value={data.waterMl} max={goal.waterMl} tint={color.water} />
        </Card>

        <Card>
          <Row>
            <Label>Today's meals</Label>
            <Button title="+ Log" variant="secondary" size="sm" onPress={() => setOpen(true)} />
          </Row>
          {data.meals.length === 0 ? (
            <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
              Nothing logged yet today.
            </Txt>
          ) : (
            data.meals.map((m) => (
              <Row key={m.id} style={{ marginTop: space.md }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" style={{ textTransform: 'capitalize' }}>{m.mealType}</Txt>
                  <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                    {m.items.map((i) => i.name).join(', ')}
                  </Txt>
                </View>
                <Txt variant="small" tone="t2">
                  {m.items.reduce((a, i) => a + (i.kcal ?? 0), 0)} kcal
                </Txt>
              </Row>
            ))
          )}
        </Card>
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: color.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderTopWidth: 1,
              borderColor: color.line,
              padding: space.lg,
              paddingBottom: insets.bottom + space.lg,
              gap: space.md,
            }}
          >
            <Row>
              <Txt variant="heading">Log a meal</Txt>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button"
                accessibilityLabel="Close">
                <Txt variant="small" tone="t2">Close</Txt>
              </Pressable>
            </Row>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {MEALS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMealType(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mealType === m }}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: mealType === m ? color.accentSoft : color.surface2,
                    borderWidth: 1,
                    borderColor: mealType === m ? color.accentEdge : color.line,
                  }}
                >
                  <Txt variant="caption" tone={mealType === m ? 'accent' : 't2'}
                    style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                    {m}
                  </Txt>
                </Pressable>
              ))}
            </View>

            <TextInput value={name} onChangeText={setName} placeholder="What did you eat?"
              placeholderTextColor={color.t4} accessibilityLabel="Food name" style={input} />
            {/* Catalogue matches fill both fields at once; typing a name the gym
                already knows should not also mean typing its calories. */}
            {(foodResults?.foods ?? []).length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}>
                {foodResults!.foods.slice(0, 8).map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => { setName(f.name); setKcal(String(f.kcal ?? '')); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${f.name}`}
                    style={{
                      paddingHorizontal: space.lg,
                      height: 34,
                      borderRadius: radius.pill,
                      backgroundColor: color.surface2,
                      borderWidth: 1,
                      borderColor: color.line,
                      justifyContent: 'center',
                    }}
                  >
                    <Txt variant="caption" tone="t2" style={{ fontWeight: '600' }}>
                      {f.name}{f.kcal ? ` · ${f.kcal}` : ''}
                    </Txt>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <TextInput value={kcal} onChangeText={setKcal} placeholder="Calories (optional)"
              placeholderTextColor={color.t4} keyboardType="number-pad"
              accessibilityLabel="Calories" style={input} />

            <Button title="Log meal" onPress={addMeal} disabled={!name.trim()} loading={meal.isPending} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
