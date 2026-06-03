import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  CollapsingHeader,
  Icon,
  Stepper,
  Txt,
  health,
} from '../../src/design-system';
import type { IconName } from '../../src/design-system';
import { BackButton } from '../../src/navigation/BackButton';
import { track } from '../../src/analytics';
import { useHaptics } from '../../src/lib/use-haptics';
import { usePrefs, type DailyGoals } from '../../src/auth/prefs-store';

/**
 * Editable definitions for the three activity-ring targets. These are the goals
 * that actually drive the rings on Home / Health / Activity — we only surface
 * goals with a real consumer (no dead settings). Sleep / water / workout targets
 * are deferred until a screen reads them.
 */
const FIELDS: {
  key: keyof DailyGoals;
  label: string;
  hint: string;
  icon: IconName;
  color: string;
  step: number;
  min: number;
  max: number;
  suffix?: string;
}[] = [
  { key: 'steps', label: 'Daily steps', hint: 'Move ring target', icon: 'flash', color: health.activity, step: 500, min: 1000, max: 50000 },
  { key: 'activeEnergy', label: 'Active energy', hint: 'Calories burned moving', icon: 'flame', color: health.body, step: 50, min: 100, max: 2000, suffix: 'kcal' },
  { key: 'activeMinutes', label: 'Active minutes', hint: 'Minutes of movement', icon: 'flash', color: health.mind, step: 5, min: 10, max: 240, suffix: 'min' },
];

export default function GoalsScreen() {
  const router = useRouter();
  const haptic = useHaptics();
  const goals = usePrefs((s) => s.goals);
  const setGoals = usePrefs((s) => s.setGoals);

  const [draft, setDraft] = useState<DailyGoals>(goals);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    draft.steps !== goals.steps ||
    draft.activeEnergy !== goals.activeEnergy ||
    draft.activeMinutes !== goals.activeMinutes;

  const update = (key: keyof DailyGoals, value: number) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  async function onSave() {
    setSaving(true);
    try {
      // Optimistic by nature: the prefs store updates in-memory + persists; the
      // rings re-read immediately on the next render of any consumer.
      await setGoals(draft);
      track({ name: 'goals_updated' });
      haptic.success();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsingHeader
      title="Goals"
      subtitle="Your daily activity targets"
      left={<BackButton className="" />}
    >
      {FIELDS.map((f) => (
        <Card key={f.key} className="mb-md">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-sm pr-md">
              <View
                className="h-[36px] w-[36px] items-center justify-center rounded-full"
                style={{ backgroundColor: f.color + '22' }}
              >
                <Icon name={f.icon} size={18} color={f.color} />
              </View>
              <View className="flex-1">
                <Txt variant="body-md" weight="600" className="text-ink">
                  {f.label}
                </Txt>
                <Txt variant="caption" className="text-mute">
                  {f.hint}
                </Txt>
              </View>
            </View>
            <Stepper
              value={draft[f.key]}
              onChange={(v) => update(f.key, v)}
              step={f.step}
              min={f.min}
              max={f.max}
              suffix={f.suffix}
            />
          </View>
        </Card>
      ))}

      <View className="mt-sm">
        <Button
          title={saved && !dirty ? 'Saved' : 'Save goals'}
          fullWidth
          disabled={!dirty}
          loading={saving}
          onPress={onSave}
        />
      </View>

      {saved && !dirty ? (
        <Txt variant="body-sm" className="mt-sm text-center text-success">
          Targets updated — your rings now score against these.
        </Txt>
      ) : (
        <Txt variant="caption" className="mt-sm text-center text-mute">
          These are targets, not data. Your ring values always come from real
          tracked activity.
        </Txt>
      )}

      <View className="mt-lg items-center">
        <Button title="Done" variant="ghost" onPress={() => router.back()} />
      </View>
    </CollapsingHeader>
  );
}
