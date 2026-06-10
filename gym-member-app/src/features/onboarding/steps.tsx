import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Icon,
  Logo,
  ProgressRing,
  SegmentedControl,
  Txt,
  elevation,
  useThemeColors,
  type IconName,
} from '../../design-system';
import { OnboardingStepShell } from './components/OnboardingStepShell';
import { SelectionCard } from './components/SelectionCard';
import { MultiSelectGrid } from './components/MultiSelectGrid';
import { Wheel, type WheelItem } from './components/Wheel';
import { DobPicker } from './components/DobPicker';
import {
  ACTIVITY_OPTIONS,
  EXPERIENCE_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  LIMITATION_OPTIONS,
  WORKOUT_OPTIONS,
  cmToFtIn,
  ftInToCm,
  goalLabel,
  kgToLb,
  lbToKg,
} from './options';
import { useOnboarding } from './onboarding-store';
import { track } from '../../analytics';
import type {
  ActivityLevel,
  ExperienceLevel,
  FitnessGoal,
  Gender,
  WorkoutPreference,
} from '../../api/types';

/** Reassurance rundown shown on the summary step. */
const READY_ITEMS: { icon: IconName; label: string }[] = [
  { icon: 'flame', label: 'Daily calorie target' },
  { icon: 'dumbbell', label: 'Protein & macro goals' },
  { icon: 'heart', label: 'Hydration target' },
  { icon: 'calendar', label: 'Weekly training split' },
];

const HEIGHT_MIN_CM = 120;
const HEIGHT_MAX_CM = 220;
const WEIGHT_MIN_KG = 30;
const WEIGHT_MAX_KG = 200;
const DEFAULT_HEIGHT = 170;
const DEFAULT_WEIGHT = 70;

function range(min: number, max: number): WheelItem<number>[] {
  return Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, label: String(min + i) }));
}

/** Whole years between an ISO `YYYY-MM-DD` birthdate and today, or null. */
function ageFromIso(iso?: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const hadBirthday = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// ── 1 · Welcome ────────────────────────────────────────────────────
export function WelcomeStep() {
  const theme = useThemeColors();
  const { goNext, saving } = useOnboarding();
  return (
    <OnboardingStepShell
      step="welcome"
      title=""
      onNext={() => goNext()}
      nextLabel="Continue"
      saving={saving}
      scroll={false}
    >
      <View className="flex-1 items-center justify-center">
        {/* Brand hero emblem — concentric soft-lime orb cradling a primary mark. */}
        <View
          className="items-center justify-center rounded-full bg-accent-soft"
          style={{ width: 128, height: 128 }}
        >
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 80, height: 80, backgroundColor: theme.primary, ...elevation.card }}
          >
            <Icon name="dumbbell" size={36} color={theme.onPrimary} filled />
          </View>
        </View>

        <View className="mt-2xl">
          <Logo height={24} />
        </View>
        <Txt
          variant="display-lg"
          weight="600"
          className="mt-lg text-center text-ink"
          style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1 }}
        >
          Let&apos;s build your{'\n'}fitness journey
        </Txt>
        <Txt variant="body-md" className="mt-sm px-lg text-center text-body" style={{ lineHeight: 24 }}>
          We&apos;ll personalize workouts, nutrition and progress tracking just for you.
        </Txt>
        <View className="mt-xl flex-row items-center rounded-pill bg-canvas-soft px-md py-xs">
          <Icon name="flash" size={15} color={theme.accent} filled />
          <Txt variant="body-sm" weight="500" className="ml-xs text-body">
            Takes less than a minute
          </Txt>
        </View>
      </View>
    </OnboardingStepShell>
  );
}

// ── 2 · Gender ─────────────────────────────────────────────────────
export function GenderStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const value = draft.gender;
  return (
    <OnboardingStepShell
      step="gender"
      title="What's your gender?"
      subtitle="Used to tailor your calorie and recovery targets."
      onBack={goBack}
      onNext={() => goNext({ gender: value })}
      nextDisabled={!value}
      saving={saving}
    >
      {GENDER_OPTIONS.map((o) => (
        <SelectionCard
          key={o.value}
          label={o.label}
          icon={o.icon}
          selected={value === o.value}
          onPress={() => update({ gender: o.value as Gender })}
        />
      ))}
    </OnboardingStepShell>
  );
}

// ── 3 · Date of birth ──────────────────────────────────────────────
export function DobStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const dob = draft.dateOfBirth ?? null;
  const age = ageFromIso(dob);
  return (
    <OnboardingStepShell
      step="dob"
      title="When were you born?"
      subtitle="We use your age to personalize your plan."
      onBack={goBack}
      onNext={() => goNext({ dateOfBirth: draft.dateOfBirth })}
      nextDisabled={!draft.dateOfBirth}
      saving={saving}
      scroll={false}
    >
      <View className="flex-1 items-center justify-center pb-2xl">
        {/* Derived-age hero — makes the abstract date feel personal. */}
        <View className="mb-xl h-[72px] items-center justify-center">
          {age != null ? (
            <View className="flex-row items-baseline">
              <Txt weight="600" className="text-primary" style={{ fontSize: 56, lineHeight: 60, letterSpacing: -2 }}>
                {age}
              </Txt>
              <Txt variant="body-lg" weight="500" className="ml-xs text-mute">
                years old
              </Txt>
            </View>
          ) : (
            <Txt variant="body-md" className="text-mute">
              Set your date of birth
            </Txt>
          )}
        </View>
        <DobPicker value={dob} onChange={(iso) => update({ dateOfBirth: iso })} />
      </View>
    </OnboardingStepShell>
  );
}

// ── 4 · Height ─────────────────────────────────────────────────────
export function HeightStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const unit = draft.heightUnit ?? 'cm';
  const cm = draft.heightCm ?? DEFAULT_HEIGHT;
  const { ft, inch } = cmToFtIn(cm);

  return (
    <OnboardingStepShell
      step="height"
      title="How tall are you?"
      onBack={goBack}
      onNext={() => goNext({ heightCm: draft.heightCm ?? DEFAULT_HEIGHT, heightUnit: unit })}
      saving={saving}
      scroll={false}
    >
      <View className="flex-1 items-center justify-center pb-2xl">
        {/* Hero value — the focal point; the wheel below fine-tunes it. */}
        <View className="mb-xl flex-row items-baseline">
          <Txt weight="600" className="text-primary" style={{ fontSize: 56, lineHeight: 60, letterSpacing: -2 }}>
            {unit === 'cm' ? String(cm) : `${ft}′ ${inch}″`}
          </Txt>
          {unit === 'cm' ? (
            <Txt variant="body-lg" weight="500" className="ml-xs text-mute">
              cm
            </Txt>
          ) : null}
        </View>

        <View style={{ width: 220 }}>
          <SegmentedControl
            options={[
              { label: 'cm', value: 'cm' },
              { label: 'ft / in', value: 'ft' },
            ]}
            value={unit}
            onChange={(u) => update({ heightUnit: u as 'cm' | 'ft' })}
          />
        </View>

        <View className="mt-xl flex-row items-center justify-center" style={{ gap: 12 }}>
          {unit === 'cm' ? (
            <Wheel
              items={range(HEIGHT_MIN_CM, HEIGHT_MAX_CM)}
              value={cm}
              suffix="cm"
              onChange={(v) => update({ heightCm: v })}
              width={120}
            />
          ) : (
            <>
              <Wheel
                items={Array.from({ length: 5 }, (_, i) => ({ value: i + 3, label: `${i + 3} ft` }))}
                value={ft}
                onChange={(f) => update({ heightCm: ftInToCm(f, inch) })}
                width={96}
              />
              <Wheel
                items={Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i} in` }))}
                value={inch}
                onChange={(n) => update({ heightCm: ftInToCm(ft, n) })}
                width={96}
              />
            </>
          )}
        </View>
      </View>
    </OnboardingStepShell>
  );
}

// ── 5 · Weight ─────────────────────────────────────────────────────
export function WeightStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const unit = draft.weightUnit ?? 'kg';
  const kg = draft.weightKg ?? DEFAULT_WEIGHT;

  return (
    <OnboardingStepShell
      step="weight"
      title="What's your weight?"
      onBack={goBack}
      onNext={() => goNext({ weightKg: draft.weightKg ?? DEFAULT_WEIGHT, weightUnit: unit })}
      saving={saving}
      scroll={false}
    >
      <View className="flex-1 items-center justify-center pb-2xl">
        {/* Hero value — the focal point; the wheel below fine-tunes it. */}
        <View className="mb-xl flex-row items-baseline">
          <Txt weight="600" className="text-primary" style={{ fontSize: 56, lineHeight: 60, letterSpacing: -2 }}>
            {unit === 'kg' ? String(kg) : String(kgToLb(kg))}
          </Txt>
          <Txt variant="body-lg" weight="500" className="ml-xs text-mute">
            {unit}
          </Txt>
        </View>

        <View style={{ width: 160 }}>
          <SegmentedControl
            options={[
              { label: 'kg', value: 'kg' },
              { label: 'lb', value: 'lb' },
            ]}
            value={unit}
            onChange={(u) => update({ weightUnit: u as 'kg' | 'lb' })}
          />
        </View>

        <View className="mt-xl">
          {unit === 'kg' ? (
            <Wheel
              items={range(WEIGHT_MIN_KG, WEIGHT_MAX_KG)}
              value={kg}
              suffix="kg"
              onChange={(v) => update({ weightKg: v })}
              width={130}
            />
          ) : (
            <Wheel
              items={range(kgToLb(WEIGHT_MIN_KG), kgToLb(WEIGHT_MAX_KG))}
              value={kgToLb(kg)}
              suffix="lb"
              onChange={(lb) => update({ weightKg: lbToKg(lb) })}
              width={130}
            />
          )}
        </View>
      </View>
    </OnboardingStepShell>
  );
}

// ── 6 · Goals (multi-select; first pick is primary) ────────────────
export function GoalsStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const goals = draft.goals ?? [];

  const toggle = (g: FitnessGoal) => {
    const next = goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g];
    update({ goals: next, primaryGoal: next[0] });
  };

  return (
    <OnboardingStepShell
      step="goals"
      title="What are your goals?"
      subtitle="Pick all that apply — your first pick leads your plan."
      onBack={goBack}
      onNext={() => goNext({ goals, primaryGoal: goals[0] })}
      nextDisabled={goals.length === 0}
      saving={saving}
    >
      <MultiSelectGrid options={GOAL_OPTIONS} selected={goals} onToggle={toggle} />
    </OnboardingStepShell>
  );
}

// ── 7 · Activity level ─────────────────────────────────────────────
export function ActivityStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const value = draft.activityLevel;
  return (
    <OnboardingStepShell
      step="activity"
      title="How active are you?"
      subtitle="Outside of workouts — your typical day."
      onBack={goBack}
      onNext={() => goNext({ activityLevel: value })}
      nextDisabled={!value}
      saving={saving}
    >
      {ACTIVITY_OPTIONS.map((o) => (
        <SelectionCard
          key={o.value}
          label={o.label}
          description={o.description}
          icon={o.icon}
          selected={value === o.value}
          onPress={() => update({ activityLevel: o.value as ActivityLevel })}
        />
      ))}
    </OnboardingStepShell>
  );
}

// ── 8 · Training experience ────────────────────────────────────────
export function ExperienceStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const value = draft.trainingExperience;
  return (
    <OnboardingStepShell
      step="experience"
      title="Your training experience?"
      onBack={goBack}
      onNext={() => goNext({ trainingExperience: value })}
      nextDisabled={!value}
      saving={saving}
    >
      {EXPERIENCE_OPTIONS.map((o) => (
        <SelectionCard
          key={o.value}
          label={o.label}
          description={o.description}
          icon={o.icon}
          selected={value === o.value}
          onPress={() => update({ trainingExperience: o.value as ExperienceLevel })}
        />
      ))}
    </OnboardingStepShell>
  );
}

// ── 9 · Workout preferences (multi-select) ─────────────────────────
export function PreferencesStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const prefs = draft.workoutPreferences ?? [];
  const toggle = (p: WorkoutPreference) =>
    update({ workoutPreferences: prefs.includes(p) ? prefs.filter((x) => x !== p) : [...prefs, p] });
  return (
    <OnboardingStepShell
      step="preferences"
      title="How do you like to train?"
      subtitle="Pick all that apply."
      onBack={goBack}
      onNext={() => goNext({ workoutPreferences: prefs })}
      nextDisabled={prefs.length === 0}
      saving={saving}
    >
      <MultiSelectGrid options={WORKOUT_OPTIONS} selected={prefs} onToggle={toggle} />
    </OnboardingStepShell>
  );
}

// ── 10 · Health & limitations (optional) ───────────────────────────
export function LimitationsStep() {
  const { draft, update, goNext, goBack, saving } = useOnboarding();
  const limits = draft.limitations ?? [];
  const toggle = (l: string) =>
    update({ limitations: limits.includes(l) ? limits.filter((x) => x !== l) : [...limits, l] });
  return (
    <OnboardingStepShell
      step="limitations"
      title="Any injuries or limitations?"
      subtitle="Optional — helps us keep your plan safe. You can skip this."
      onBack={goBack}
      onNext={() => goNext({ limitations: limits })}
      onSkip={() => {
        track({ name: 'onboarding_skipped', step: 'limitations' });
        void goNext({ limitations: [] });
      }}
      saving={saving}
    >
      <MultiSelectGrid
        options={LIMITATION_OPTIONS.map((l) => ({ value: l, label: l }))}
        selected={limits}
        onToggle={toggle}
      />
    </OnboardingStepShell>
  );
}

// ── 11 · Summary (personalized targets) ────────────────────────────
export function SummaryStep() {
  const theme = useThemeColors();
  const router = useRouter();
  const { draft, goBack, finish, saving, error } = useOnboarding();
  const [busy, setBusy] = useState(false);

  // Targets aren't recomputed client-side — the server returns the authoritative
  // `recommendation` after finish(). Here we celebrate the chosen goal so the
  // screen feels personalized before the home dashboard takes over.
  const onFinish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await finish();
      router.replace('/home');
    } catch {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepShell
      step="summary"
      title="You're all set!"
      subtitle="We've built a plan around your goals. You can fine-tune anything later in Profile."
      onBack={goBack}
      onNext={onFinish}
      nextLabel="Start training"
      saving={saving || busy}
    >
      <Card elevated className="mb-lg items-center p-lg">
        {/* Celebratory hero — a filled primary ring cradling the check. */}
        <ProgressRing progress={1} size={104} strokeWidth={8} color={theme.primary} trackColor={theme.hairline}>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 64, height: 64, backgroundColor: theme.primary }}
          >
            <Icon name="check" size={32} color={theme.onPrimary} filled />
          </View>
        </ProgressRing>

        <View className="mt-md flex-row items-center rounded-pill bg-accent-soft px-md py-xxs">
          <Icon name="flash" size={13} color={theme.accent} filled />
          <Txt variant="caption" weight="600" className="ml-xxs" style={{ color: theme.accent }}>
            PLAN READY
          </Txt>
        </View>

        <Txt variant="display-sm" weight="600" className="mt-sm text-center text-ink">
          {goalLabel(draft.primaryGoal)}
        </Txt>
        <Txt variant="body-sm" className="mt-xxs text-center text-body">
          Tuned to your body, experience and schedule.
        </Txt>
      </Card>

      {/* What we've prepared — a quick, reassuring rundown. */}
      <View className="rounded-xl border border-hairline bg-surface">
        {READY_ITEMS.map((item, i) => (
          <View
            key={item.label}
            className={`flex-row items-center px-md py-sm ${i > 0 ? 'border-t border-hairline' : ''}`}
          >
            <View
              className="mr-md h-[36px] w-[36px] items-center justify-center rounded-full bg-accent-soft"
            >
              <Icon name={item.icon} size={18} color={theme.accent} filled />
            </View>
            <Txt variant="body-md" weight="500" className="flex-1 text-ink">
              {item.label}
            </Txt>
            <Icon name="check" size={18} color={theme.primary} filled />
          </View>
        ))}
      </View>

      {error ? (
        <Txt variant="body-sm" className="mt-md text-center text-error">
          {error}
        </Txt>
      ) : null}
    </OnboardingStepShell>
  );
}
