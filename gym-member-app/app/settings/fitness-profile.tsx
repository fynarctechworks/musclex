import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, Stepper, Txt } from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';
import { useHaptics } from '../../src/lib/use-haptics';
import { track } from '../../src/analytics';
import { api } from '../../src/api/endpoints';
import { queryClient } from '../../src/lib/query-client';
import { useAuth } from '../../src/auth/auth-store';
import { SelectionCard } from '../../src/features/onboarding/components/SelectionCard';
import { MultiSelectGrid } from '../../src/features/onboarding/components/MultiSelectGrid';
import {
  ACTIVITY_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  LIMITATION_OPTIONS,
  WORKOUT_OPTIONS,
} from '../../src/features/onboarding/options';
import type {
  ActivityLevel,
  ExperienceLevel,
  FitnessGoal,
  UpdateProfileInput,
  WorkoutPreference,
} from '../../src/api/types';

/**
 * Edit the fitness profile collected during onboarding. Saving PATCHes /me; the
 * server recomputes the personalization targets (calories / protein / water) and
 * the nutrition goal, so Home + Nutrition update automatically. Reuses the same
 * option lists + selection components as the onboarding flow (no divergence).
 */
export default function FitnessProfileScreen() {
  const router = useRouter();
  const haptic = useHaptics();
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);

  const [goals, setGoals] = useState<FitnessGoal[]>(profile?.goals ?? []);
  const [activity, setActivity] = useState<ActivityLevel | undefined>(profile?.activityLevel ?? undefined);
  const [experience, setExperience] = useState<ExperienceLevel | undefined>(
    profile?.trainingExperience ?? undefined,
  );
  const [prefs, setPrefs] = useState<WorkoutPreference[]>(profile?.workoutPreferences ?? []);
  const [heightCm, setHeightCm] = useState<number>(profile?.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState<number>(profile?.weightKg ?? 70);
  const [limits, setLimits] = useState<string[]>(profile?.limitations ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const dirty = useMemo(() => {
    const p = profile;
    return (
      JSON.stringify(goals) !== JSON.stringify(p?.goals ?? []) ||
      activity !== (p?.activityLevel ?? undefined) ||
      experience !== (p?.trainingExperience ?? undefined) ||
      JSON.stringify(prefs) !== JSON.stringify(p?.workoutPreferences ?? []) ||
      heightCm !== (p?.heightCm ?? 170) ||
      weightKg !== (p?.weightKg ?? 70) ||
      JSON.stringify(limits) !== JSON.stringify(p?.limitations ?? [])
    );
  }, [profile, goals, activity, experience, prefs, heightCm, weightKg, limits]);

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  async function onSave() {
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      const patch: UpdateProfileInput = {
        goals,
        primaryGoal: goals[0],
        activityLevel: activity,
        trainingExperience: experience,
        workoutPreferences: prefs,
        heightCm,
        weightKg,
        limitations: limits,
      };
      const updated = await api.updateMe(patch);
      setProfile(updated);
      // Keep the react-query `me` cache + anything reading it (Profile screen) in
      // sync, and refetch Home so its personalized cards update immediately.
      queryClient.setQueryData(['me'], updated);
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      track({ name: 'goals_updated' });
      haptic.success();
      setSaved(true);
    } catch {
      haptic.error();
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Fitness profile" className="mb-xs" />
      <Txt variant="body-sm" className="mb-lg text-body">
        Personalizes your plan, nutrition & dashboard
      </Txt>
      <Section title="GOALS">
        <MultiSelectGrid
          options={GOAL_OPTIONS}
          selected={goals}
          onToggle={(g) => {
            const next = toggle(goals, g);
            setGoals(next);
            setSaved(false);
          }}
        />
      </Section>

      <Section title="ACTIVITY LEVEL">
        {ACTIVITY_OPTIONS.map((o) => (
          <SelectionCard
            key={o.value}
            label={o.label}
            description={o.description}
            icon={o.icon}
            selected={activity === o.value}
            onPress={() => {
              setActivity(o.value);
              setSaved(false);
            }}
          />
        ))}
      </Section>

      <Section title="EXPERIENCE">
        {EXPERIENCE_OPTIONS.map((o) => (
          <SelectionCard
            key={o.value}
            label={o.label}
            description={o.description}
            icon={o.icon}
            selected={experience === o.value}
            onPress={() => {
              setExperience(o.value);
              setSaved(false);
            }}
          />
        ))}
      </Section>

      <Section title="WORKOUT PREFERENCES">
        <MultiSelectGrid
          options={WORKOUT_OPTIONS}
          selected={prefs}
          onToggle={(p) => {
            setPrefs(toggle(prefs, p));
            setSaved(false);
          }}
        />
      </Section>

      <Section title="BODY">
        <Card className="mb-sm">
          <View className="flex-row items-center justify-between">
            <Txt variant="body-md" weight="600" className="text-ink">
              Height
            </Txt>
            <Stepper value={heightCm} onChange={(v) => { setHeightCm(v); setSaved(false); }} step={1} min={120} max={220} suffix="cm" />
          </View>
        </Card>
        <Card>
          <View className="flex-row items-center justify-between">
            <Txt variant="body-md" weight="600" className="text-ink">
              Weight
            </Txt>
            <Stepper value={weightKg} onChange={(v) => { setWeightKg(v); setSaved(false); }} step={1} min={30} max={200} suffix="kg" />
          </View>
        </Card>
      </Section>

      <Section title="INJURIES / LIMITATIONS">
        <MultiSelectGrid
          options={LIMITATION_OPTIONS.map((l) => ({ value: l, label: l }))}
          selected={limits}
          onToggle={(l) => {
            setLimits(toggle(limits, l));
            setSaved(false);
          }}
        />
      </Section>

      <View className="mt-md">
        <Button
          title={saved && !dirty ? 'Saved' : 'Save changes'}
          fullWidth
          disabled={!dirty || goals.length === 0}
          loading={saving}
          onPress={onSave}
        />
      </View>
      {saved && !dirty ? (
        <Txt variant="body-sm" className="mt-sm text-center text-success">
          Updated — your plan, nutrition targets and dashboard now reflect this.
        </Txt>
      ) : null}
      {error ? (
        <Txt variant="body-sm" className="mt-sm text-center text-error">
          Couldn't save — check your connection and try again.
        </Txt>
      ) : null}

      <View className="mt-lg items-center">
        <Button title="Done" variant="ghost" onPress={() => router.back()} />
      </View>

      <View className="h-2xl" />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-lg">
      <Txt variant="caption" className="mb-sm text-mute">
        {title}
      </Txt>
      {children}
    </View>
  );
}
