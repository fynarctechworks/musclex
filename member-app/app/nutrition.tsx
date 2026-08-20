import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Meter, Row, Txt } from '../src/ui';
import { font, color, radius, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Notice } from '../src/ui/Notice';
import { useFoods, useLogMeal, useLogWater, useNutrition, useSetNutritionGoal } from '../src/api/queries';
import {
  applySettings,
  computeTimes,
  ensurePermission,
  INTERVAL_CHOICES,
  loadSettings,
  remindersSupported,
  type WaterReminderSettings,
} from '../src/lib/water-reminders';

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

        <WaterReminders />

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

/**
 * Water reminder scheduling.
 *
 * Kept beside the water tracker rather than buried in settings: the moment a
 * member notices they are behind on water is the moment they will want the
 * nudge, and a reminder screen nobody finds reminds nobody.
 */
function WaterReminders() {
  const [settings, setSettings] = useState<WaterReminderSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  // Offering a toggle that cannot fire is worse than offering nothing: the
  // member would switch it on, trust it, and never be reminded.
  if (!remindersSupported() || !settings) return null;

  async function commit(next: WaterReminderSettings) {
    setBusy(true);
    setNotice(null);
    try {
      if (next.enabled) {
        const ok = await ensurePermission();
        if (!ok) {
          // Persisting `enabled` here would leave a toggle that says ON while
          // the OS silently drops every notification.
          setNotice({
            tone: 'error',
            title: 'Notifications are turned off',
            body: 'Allow notifications for MuscleX in your phone settings, then try again.',
          });
          return;
        }
      }
      const count = await applySettings(next);
      setSettings(next);
      setNotice(
        next.enabled
          ? { tone: 'success', title: `${count} reminders a day`, body: describe(next) }
          : { tone: 'success', title: 'Reminders off' },
      );
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not update reminders',
        body: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row>
        <Label>Drink reminders</Label>
        <Button
          title={settings.enabled ? 'Turn off' : 'Turn on'}
          variant="secondary"
          size="sm"
          loading={busy}
          onPress={() => commit({ ...settings, enabled: !settings.enabled })}
        />
      </Row>

      <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
        {settings.enabled ? describe(settings) : 'A quiet nudge through the day so you do not finish at 6pm on one glass.'}
      </Txt>

      {settings.enabled ? (
        <>
          <Row style={{ gap: space.sm, marginTop: space.md, justifyContent: 'flex-start' }}>
            {INTERVAL_CHOICES.map((c) => (
              <Pressable
                key={c.minutes}
                onPress={() => commit({ ...settings, everyMinutes: c.minutes })}
                accessibilityRole="radio"
                accessibilityState={{ selected: settings.everyMinutes === c.minutes }}
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: settings.everyMinutes === c.minutes ? color.accent : color.line,
                  backgroundColor: settings.everyMinutes === c.minutes ? color.accentSoft : 'transparent',
                }}
              >
                <Txt variant="caption" tone={settings.everyMinutes === c.minutes ? 't1' : 't2'}>
                  {c.label}
                </Txt>
              </Pressable>
            ))}
          </Row>

          <Row style={{ gap: space.sm, marginTop: space.md }}>
            <HourField
              label="From"
              value={settings.startHour}
              onChange={(h) => commit({ ...settings, startHour: h })}
            />
            <HourField
              label="Until"
              value={settings.endHour}
              onChange={(h) => commit({ ...settings, endHour: h })}
            />
          </Row>
        </>
      ) : null}

      {notice ? (
        <View style={{ marginTop: space.md }}>
          <Notice {...notice} onDismiss={() => setNotice(null)} />
        </View>
      ) : null}
    </Card>
  );
}

function describe(s: WaterReminderSettings): string {
  const n = computeTimes(s).length;
  const every = INTERVAL_CHOICES.find((c) => c.minutes === s.everyMinutes)?.label ?? `Every ${s.everyMinutes} min`;
  if (n === 0) return 'No reminders — check the from/until times.';
  return `${every.toLowerCase()}, ${pad(s.startHour)}:00 to ${pad(s.endHour)}:00.`;
}

const pad = (h: number) => String(h).padStart(2, '0');

function HourField({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="caption" tone="t3" style={{ marginBottom: 4 }}>{label}</Txt>
      <TextInput
        value={text}
        onChangeText={setText}
        // Commit on blur, not per keystroke: rescheduling on every digit would
        // cancel and rebuild the whole schedule while the member is still typing.
        onBlur={() => {
          const n = Number.parseInt(text, 10);
          if (Number.isFinite(n) && n >= 0 && n <= 23) onChange(n);
          else setText(String(value));
        }}
        keyboardType="number-pad"
        accessibilityLabel={`${label} hour`}
        style={{
          height: 42,
          borderRadius: radius.sm,
          backgroundColor: color.surface2,
          borderWidth: 1,
          borderColor: color.line,
          color: color.t1,
          paddingHorizontal: space.md,
          fontFamily: font,
          fontSize: 15,
        }}
      />
    </View>
  );
}
