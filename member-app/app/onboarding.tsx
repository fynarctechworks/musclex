import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Meter, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { font, color, radius, space } from '../src/ui/theme';
import { useQueryClient } from '@tanstack/react-query';
import { qk, useUpdateMe } from '../src/api/queries';
import { useUnits } from '../src/lib/use-units';

/**
 * ────────────────────────────────────────────────────────────────
 * ONBOARDING
 * ────────────────────────────────────────────────────────────────
 *
 * Asked once, right after a member's first sign-in, because targets computed
 * from nothing are worse than no targets at all.
 *
 * Rules it follows:
 *   - every step is skippable, and skipping is a plain visible control rather
 *     than something buried. A gym already knows who this person is; the app
 *     has not earned the right to block them.
 *   - each step saves as it advances (`onboardingStep`), so a member who quits
 *     halfway resumes rather than starting again.
 *   - the last step stamps `onboardingComplete`, which is what stops the app
 *     asking again.
 */

const GOALS = [
  ['lose_weight', 'Lose weight'],
  ['gain_muscle', 'Gain muscle'],
  ['build_strength', 'Build strength'],
  ['improve_fitness', 'Get fitter'],
  ['improve_endurance', 'More endurance'],
  ['stay_healthy', 'Stay healthy'],
] as const;

const LEVELS = [
  ['beginner', 'New to training'],
  ['intermediate', 'Train regularly'],
  ['advanced', 'Been at it years'],
] as const;

const ACTIVITY = [
  ['sedentary', 'Mostly sitting'],
  ['lightly_active', 'Lightly active'],
  ['moderately_active', 'Moderately active'],
  ['very_active', 'Very active'],
] as const;

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        paddingHorizontal: space.lg,
        height: 46,
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: selected ? color.accentSoft : color.surface2,
        borderWidth: 1,
        borderColor: selected ? color.accentEdge : color.line,
        marginBottom: space.sm,
      }}
    >
      <Txt variant="body" tone={selected ? 'accent' : 't1'} style={{ fontWeight: selected ? '600' : '400' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const STEPS = ['goal', 'level', 'activity', 'body'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const save = useUpdateMe();
  const qc = useQueryClient();
  const u = useUnits();

  const [index, setIndex] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const step: Step = STEPS[index];
  const last = index === STEPS.length - 1;

  async function advance(payload: Record<string, unknown>) {
    setError(null);
    try {
      await save.mutateAsync({
        ...payload,
        ...(last ? { onboardingComplete: true } : { onboardingStep: STEPS[index + 1] }),
      });
      if (last) {
        // Write completion into the cache the router gate reads BEFORE
        // navigating. Relying on invalidation alone raced: the redirect landed
        // while `me` was still stale, so the gate bounced the member straight
        // back into step 1 and onboarding never ended.
        qc.setQueryData(qk.me, (prev: unknown) =>
          prev ? { ...(prev as object), onboardingCompleted: true } : prev,
        );
        router.replace('/');
      } else {
        setIndex((i) => i + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.');
    }
  }

  function next() {
    if (step === 'goal') return advance(goal ? { primaryGoal: goal, goals: [goal] } : {});
    if (step === 'level') return advance(level ? { trainingExperience: level } : {});
    if (step === 'activity') return advance(activity ? { activityLevel: activity } : {});
    return advance({
      ...(height ? { heightCm: Number(height) } : {}),
      ...(weight ? { weightKg: u.toKg(Number(weight)) } : {}),
    });
  }

  const input = {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    color: color.t1,
    paddingHorizontal: space.lg,
    fontFamily: font,
    fontSize: 17,
    marginBottom: space.sm,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + space.lg }}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Row>
          <Txt variant="caption" tone="t3">
            Step {index + 1} of {STEPS.length}
          </Txt>
          <Pressable
            onPress={() => advance({})}
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
          >
            <Txt variant="small" tone="t3">{last ? 'Finish' : 'Skip'}</Txt>
          </Pressable>
        </Row>
        <Meter value={index + 1} max={STEPS.length} tint={color.accent} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Notice title="Not saved" body={error} onDismiss={() => setError(null)} /> : null}

        {step === 'goal' ? (
          <>
            <Txt variant="title">What are you training for?</Txt>
            <Txt variant="small" tone="t2">
              Your trainer sees this, and it shapes the targets the app suggests.
            </Txt>
            <Card>
              {GOALS.map(([v, l]) => (
                <Option key={v} label={l} selected={goal === v} onPress={() => setGoal(v)} />
              ))}
            </Card>
          </>
        ) : step === 'level' ? (
          <>
            <Txt variant="title">How much have you trained?</Txt>
            <Txt variant="small" tone="t2">
              This changes what a sensible starting weight looks like.
            </Txt>
            <Card>
              {LEVELS.map(([v, l]) => (
                <Option key={v} label={l} selected={level === v} onPress={() => setLevel(v)} />
              ))}
            </Card>
          </>
        ) : step === 'activity' ? (
          <>
            <Txt variant="title">How active is your day?</Txt>
            <Txt variant="small" tone="t2">
              Outside the gym. Used for calorie targets.
            </Txt>
            <Card>
              {ACTIVITY.map(([v, l]) => (
                <Option key={v} label={l} selected={activity === v} onPress={() => setActivity(v)} />
              ))}
            </Card>
          </>
        ) : (
          <>
            <Txt variant="title">Height and weight</Txt>
            <Txt variant="small" tone="t2">
              Only used for BMI and calorie targets. You can change these any time.
            </Txt>
            <Card>
              <Txt variant="caption" tone="t3" style={{ marginBottom: space.sm }}>Height (cm)</Txt>
              <TextInput
                value={height}
                onChangeText={setHeight}
                keyboardType="number-pad"
                placeholder="178"
                placeholderTextColor={color.t4}
                accessibilityLabel="Height in centimetres"
                style={input}
              />
              <Txt variant="caption" tone="t3" style={{ marginBottom: space.sm, marginTop: space.md }}>
                Weight ({u.weightUnit})
              </Txt>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="75"
                placeholderTextColor={color.t4}
                accessibilityLabel={`Weight in ${u.weightUnit}`}
                style={input}
              />
            </Card>
          </>
        )}
      </ScrollView>

      <View
        style={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.lg,
          borderTopWidth: 1,
          borderTopColor: color.line,
          backgroundColor: color.surface,
        }}
      >
        <Button
          title={last ? 'Finish' : 'Continue'}
          accessibilityLabel={last ? 'Finish setup' : 'Continue to next step'}
          onPress={next}
          loading={save.isPending}
        />
      </View>
    </View>
  );
}
