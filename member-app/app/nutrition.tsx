import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Meter, Row, Txt } from '../src/ui';
import { chart } from '../src/ui/chart-colors';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Notice } from '../src/ui/Notice';
import { useFoods, useLogMeal, useLogWater, useNutrition, useSetNutritionGoal } from '../src/api/queries';
import { useWho } from '../src/lib/use-capabilities';
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
function Macro({
  label,
  value,
  goal,
  tint,
}: {
  label: string;
  value: number;
  goal: number;
  tint: string;
}) {
  return (
    <View
      className="flex-1"
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${Math.round(value)} of ${goal} grams`}>
      <Txt variant="bodyStrong">{Math.round(value)}g</Txt>
      <Txt variant="caption" tone="t3">
        {label} · {goal}g
      </Txt>
      <Meter value={value} max={goal} tint={tint} />
    </View>
  );
}

export default function NutritionScreen() {
  const who = useWho();
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

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Nutrition" />
      <ScrollView contentContainerClassName="px-4 pb-28 gap-5">
        {notice ? (
          <Notice {...notice} onDismiss={() => setNotice(null)} />
        ) : null}

        <View>
          <Row className="mb-2">
            <Label>Calories</Label>
            {/* Editing a target writes to /nutrition/goal, which is gym-only.
                Offering the button to someone with no gym would open an editor
                that 403s on save — worse than not offering it. */}
            {who.hasGym ? (
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
            ) : null}
          </Row>
          <Card className="gap-3">
          <Row className="items-baseline">
            <View className="flex-row items-baseline gap-1.5">
              <Txt variant="display">{Math.round(totals.kcal)}</Txt>
              <Txt variant="small" tone="t3">
                of {goal.kcal} kcal
              </Txt>
            </View>
            {/* Over the target is worth saying plainly rather than as a
                negative number the member has to interpret. */}
            <Txt variant="small" tone={totals.kcal > goal.kcal ? 'accent' : 't2'}>
              {totals.kcal > goal.kcal
                ? `${Math.round(totals.kcal) - goal.kcal} over`
                : `${goal.kcal - Math.round(totals.kcal)} left`}
            </Txt>
          </Row>
          <Meter value={totals.kcal} max={goal.kcal} tint={chart.accent} />
          {/* Say whose target this is. Without a gym there is nowhere to store a
              personal one yet, so the bar is drawn against a general default —
              and a default presented as "your goal" is the app inventing a
              number and attributing it to the member. */}
          {!who.hasGym ? (
            <Txt variant="caption" tone="t3">
              Measured against a general daily target, not one you have set.
            </Txt>
          ) : null}
          {editingGoal ? (
            <View className="border-border gap-2 border-t pt-3">
              <Txt variant="caption" tone="t3">Daily calories</Txt>
              <Input
                value={gKcal}
                onChangeText={setGKcal}
                keyboardType="number-pad"
                accessibilityLabel="Calorie target"
              />
              <Txt variant="caption" tone="t3">Protein (g)</Txt>
              <Input
                value={gProtein}
                onChangeText={setGProtein}
                keyboardType="number-pad"
                accessibilityLabel="Protein target"
              />
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

          <Row className="items-start gap-4">
            <Macro label="Protein" value={totals.proteinG} goal={goal.proteinG} tint={chart.protein} />
            <Macro label="Carbs" value={totals.carbsG} goal={goal.carbsG} tint={chart.carbs} />
            <Macro label="Fat" value={totals.fatG} goal={goal.fatG} tint={chart.fat} />
          </Row>
          </Card>
        </View>

        <View>
          <Row className="mb-2">
            <Label>Water</Label>
          </Row>
          <Card className="gap-3">
            <Row className="items-baseline">
              <View className="flex-row items-baseline gap-1.5">
                <Txt variant="heading">{(data.waterMl / 1000).toFixed(1)}L</Txt>
                <Txt variant="small" tone="t3">
                  of {(goal.waterMl / 1000).toFixed(1)}L
                </Txt>
              </View>
              <Button
                title="+250ml"
                variant="secondary"
                size="sm"
                loading={water.isPending}
                onPress={() => water.mutate(250)}
              />
            </Row>
            <Meter value={data.waterMl} max={goal.waterMl} tint={chart.water} />
          </Card>
        </View>

        <WaterReminders />

        <View>
          <Row className="mb-2">
            <Label>Today's meals</Label>
          </Row>
          <Card className="gap-3">
            {data.meals.length === 0 ? (
              <Txt variant="small" tone="t3">
                Nothing logged yet today.
              </Txt>
            ) : (
              data.meals.map((m) => (
                <Row key={m.id} className="items-start">
                  <View className="flex-1 pr-3">
                    <Txt variant="body" className="capitalize">
                      {m.mealType}
                    </Txt>
                    <Txt variant="caption" tone="t3">
                      {m.items.map((i) => i.name).join(', ')}
                    </Txt>
                  </View>
                  <Txt variant="small" tone="t2">
                    {m.items.reduce((a, i) => a + (i.kcal ?? 0), 0)} kcal
                  </Txt>
                </Row>
              ))
            )}
            {/* The point of this screen. It was a small secondary button in a
                card header, weighted the same as '+250ml' water. */}
            <Button title="Log a meal" onPress={() => setOpen(true)} />
          </Card>
        </View>
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View
            className="bg-background border-border gap-4 rounded-t-2xl border-t px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 16 }}>
            <Row>
              <Txt variant="heading">Log a meal</Txt>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button"
                accessibilityLabel="Close">
                <Txt variant="small" tone="t2">Close</Txt>
              </Pressable>
            </Row>

            <View className="flex-row gap-2">
              {MEALS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMealType(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mealType === m }}
                  className={
                    mealType === m
                      ? 'border-primary/40 bg-primary/10 h-9 flex-1 items-center justify-center rounded-full border'
                      : 'border-border bg-secondary h-9 flex-1 items-center justify-center rounded-full border'
                  }>
                  <Txt
                    variant="caption"
                    tone={mealType === m ? 'accent' : 't2'}
                    className="font-semibold capitalize">
                    {m}
                  </Txt>
                </Pressable>
              ))}
            </View>

            <Input
              value={name}
              onChangeText={setName}
              placeholder="What did you eat?"
              accessibilityLabel="Food name"
            />
            {/* Catalogue matches fill both fields at once; typing a name the gym
                already knows should not also mean typing its calories. */}
            {(foodResults?.foods ?? []).length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2">
                {foodResults!.foods.slice(0, 8).map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => { setName(f.name); setKcal(String(f.kcal ?? '')); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${f.name}`}
                    className="border-border bg-secondary h-9 justify-center rounded-full border px-4">
                    <Txt variant="caption" tone="t2" className="font-semibold">
                      {f.name}{f.kcal ? ` · ${f.kcal}` : ''}
                    </Txt>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <Input
              value={kcal}
              onChangeText={setKcal}
              placeholder="Calories (optional)"
              keyboardType="number-pad"
              accessibilityLabel="Calories"
            />

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

  if (!settings) return null;

  // Expo Go on Android cannot load the notifications module at all, so the
  // controls would be a toggle that silently never fires. This is a PREVIEW
  // limitation only — a real Android build schedules these normally — so say
  // that rather than hiding the card and implying the feature is iOS-only.
  if (!remindersSupported()) {
    return (
      <View>
        <Row className="mb-2">
          <Label>Drink reminders</Label>
        </Row>
        <Card>
          <Txt variant="small" tone="t3">
            Not available while previewing in Expo Go on Android. They work normally in the
            installed app.
          </Txt>
        </Card>
      </View>
    );
  }

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

      <Txt variant="small" tone="t3">
        {settings.enabled
          ? describe(settings)
          : 'A quiet nudge through the day so you do not finish at 6pm on one glass.'}
      </Txt>

      {settings.enabled ? (
        <>
          <Row className="justify-start gap-2">
            {INTERVAL_CHOICES.map((c) => (
              <Pressable
                key={c.minutes}
                onPress={() => commit({ ...settings, everyMinutes: c.minutes })}
                accessibilityRole="radio"
                accessibilityState={{ selected: settings.everyMinutes === c.minutes }}
                className={
                  settings.everyMinutes === c.minutes
                    ? 'border-primary/40 bg-primary/10 rounded-full border px-3 py-2'
                    : 'border-border rounded-full border px-3 py-2'
                }>
                <Txt variant="caption" tone={settings.everyMinutes === c.minutes ? 't1' : 't2'}>
                  {c.label}
                </Txt>
              </Pressable>
            ))}
          </Row>

          <Row className="gap-2">
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

      {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}
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
        className="border-border bg-secondary text-foreground h-10 rounded-md border px-3 text-base"
      />
    </View>
  );
}
