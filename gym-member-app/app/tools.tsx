import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Button,
  Card,
  Input,
  Screen,
  Txt,
  useThemeColors,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useAppProfile } from '../src/api/queries';
import { api } from '../src/api/endpoints';
import type { Recommendation, ToolsComputeInput } from '../src/api/types';

const ACTIVITIES: { value: NonNullable<ToolsComputeInput['activityLevel']>; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Light' },
  { value: 'moderately_active', label: 'Moderate' },
  { value: 'very_active', label: 'Very active' },
  { value: 'athlete', label: 'Athlete' },
];
const GOALS: { value: string; label: string }[] = [
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'gain_muscle', label: 'Gain muscle' },
  { value: 'stay_healthy', label: 'Stay healthy' },
];

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      className="rounded-full border px-md py-xs"
      style={{
        borderColor: active ? theme.cyan : theme.hairline,
        backgroundColor: active ? theme.cyan + '22' : 'transparent',
      }}
    >
      <Txt variant="body-sm" weight={active ? '600' : '400'} style={{ color: active ? theme.ink : theme.body }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function ResultStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Card soft className="flex-1">
      <Txt variant="caption" className="text-mute">{label}</Txt>
      <View className="mt-xs flex-row items-end gap-xxs">
        <Txt variant="display-sm" weight="600" className="text-ink">{value}</Txt>
        {unit ? <Txt variant="caption" className="mb-[3px] text-mute">{unit}</Txt> : null}
      </View>
    </Card>
  );
}

/**
 * Fitness calculators (Phase 7.4): BMI / BMR / daily calories / water / protein.
 * Pre-filled from the user's profile; the math is computed server-side by the
 * shared PersonalizationService (single source of the formulas), so the app never
 * duplicates them.
 */
export default function ToolsScreen() {
  const profile = useAppProfile();
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [gender, setGender] = useState<ToolsComputeInput['gender']>('male');
  const [activity, setActivity] = useState<ToolsComputeInput['activityLevel']>('moderately_active');
  const [goal, setGoal] = useState<string>('stay_healthy');
  const [result, setResult] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);

  // Seed inputs from the profile once it loads.
  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    if (p.age != null) setAge(String(p.age));
    if (p.heightCm != null) setHeightCm(String(p.heightCm));
    if (p.weightKg != null) setWeightKg(String(p.weightKg));
    if (p.gender) setGender(p.gender);
    if (p.activityLevel) setActivity(p.activityLevel);
    if (p.primaryGoal) setGoal(p.primaryGoal);
    if (p.recommendation) setResult(p.recommendation);
  }, [profile.data]);

  const calculate = async () => {
    setBusy(true);
    try {
      const r = await api.computeTools({
        gender,
        age: age ? Number(age) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        activityLevel: activity,
        primaryGoal: goal,
      });
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Fitness tools" />
      <Txt variant="body-sm" className="mt-xxs text-body">BMI · BMR · calories · protein · water</Txt>

      {/* Results */}
      {result ? (
        <View className="mt-md gap-md">
          <View className="flex-row gap-md">
            <ResultStat label="BMI" value={result.bmi != null ? String(result.bmi) : '—'} unit={result.bmi != null ? bmiCategory(result.bmi) : ''} />
            <ResultStat label="BMR" value={result.bmr != null ? String(result.bmr) : '—'} unit="kcal" />
          </View>
          <View className="flex-row gap-md">
            <ResultStat label="CALORIES" value={result.dailyCalories != null ? String(result.dailyCalories) : '—'} unit="kcal/day" />
            <ResultStat label="PROTEIN" value={result.proteinG != null ? String(result.proteinG) : '—'} unit="g/day" />
            <ResultStat label="WATER" value={result.waterMl != null ? String(Math.round((result.waterMl / 1000) * 10) / 10) : '—'} unit="L/day" />
          </View>
        </View>
      ) : null}

      {/* Inputs */}
      <View className="mt-lg gap-md">
        <View className="flex-row gap-md">
          <View className="flex-1">
            <Input label="Age" keyboardType="number-pad" value={age} onChangeText={setAge} placeholder="years" />
          </View>
          <View className="flex-1">
            <Input label="Height" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} placeholder="cm" />
          </View>
          <View className="flex-1">
            <Input label="Weight" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} placeholder="kg" />
          </View>
        </View>

        <View>
          <Txt variant="caption" className="mb-xs text-mute">GENDER</Txt>
          <View className="flex-row gap-xs">
            {(['male', 'female', 'prefer_not_to_say'] as const).map((g) => (
              <Chip key={g} label={g === 'prefer_not_to_say' ? 'Other' : g[0].toUpperCase() + g.slice(1)} active={gender === g} onPress={() => setGender(g)} />
            ))}
          </View>
        </View>

        <View>
          <Txt variant="caption" className="mb-xs text-mute">ACTIVITY</Txt>
          <View className="flex-row flex-wrap gap-xs">
            {ACTIVITIES.map((a) => (
              <Chip key={a.value} label={a.label} active={activity === a.value} onPress={() => setActivity(a.value)} />
            ))}
          </View>
        </View>

        <View>
          <Txt variant="caption" className="mb-xs text-mute">GOAL</Txt>
          <View className="flex-row flex-wrap gap-xs">
            {GOALS.map((g) => (
              <Chip key={g.value} label={g.label} active={goal === g.value} onPress={() => setGoal(g.value)} />
            ))}
          </View>
        </View>

        <Button title={busy ? 'Calculating…' : 'Calculate'} size="md" onPress={calculate} disabled={busy} />
      </View>
    </Screen>
  );
}
