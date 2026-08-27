import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { color, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useComputeTools, useProfile } from '../src/api/queries';
import { useUnits } from '../src/lib/use-units';

/**
 * TOOLS — BMI, BMR, calorie and macro targets.
 *
 * Computed server-side from the member's saved profile rather than in the app,
 * so the numbers the member sees are the same ones their trainer and the
 * nutrition targets use. A second formula on the client is a second answer.
 */
export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const compute = useComputeTools();
  const u = useUnits();
  const [error, setError] = useState<string | null>(null);

  const result = compute.data;
  const ready = !!(profile?.heightCm && profile?.weightKg);

  async function run() {
    setError(null);
    try {
      await compute.mutateAsync({
        ...(profile?.gender ? { gender: profile.gender } : {}),
        ...(profile?.age ? { age: profile.age } : {}),
        ...(profile?.heightCm ? { heightCm: profile.heightCm } : {}),
        ...(profile?.weightKg ? { weightKg: profile.weightKg } : {}),
        ...(profile?.activityLevel ? { activityLevel: profile.activityLevel } : {}),
        ...(profile?.trainingExperience
          ? { trainingExperience: profile.trainingExperience }
          : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not calculate.');
    }
  }

  const stat = (k: string, v?: number | string | null, suffix = '') =>
    v == null ? null : (
      <Row key={k} className="mt-3">
        <Txt variant="small" tone="t2">{k}</Txt>
        <Txt variant="bodyStrong">
          {typeof v === 'number' ? Math.round(v).toLocaleString() : v}
          {suffix}
        </Txt>
      </Row>
    );

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Calculators" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        {error ? <Notice title="Could not calculate" body={error} onDismiss={() => setError(null)} /> : null}

        <Card>
          <Label>From your profile</Label>
          {stat('Height', profile?.heightCm != null ? u.fh(profile.heightCm) : null)}
          {stat('Weight', profile?.weightKg != null ? u.fw(profile.weightKg) : null)}
          {stat('Activity', profile?.activityLevel?.replace(/_/g, ' '))}
          {!ready ? (
            <Txt variant="small" tone="t2" className="mt-3">
              Add your height and weight in Profile to get accurate numbers.
            </Txt>
          ) : null}
          <View className="mt-4">
            <Button
              title={result ? 'Recalculate' : 'Calculate'}
              onPress={run}
              disabled={!ready}
              loading={compute.isPending}
            />
          </View>
        </Card>

        {result ? (
          <>
            <Card>
              <Label>Body</Label>
              {stat('BMI', result.bmi)}
              {stat('Category', result.bmiCategory?.replace(/_/g, ' '))}
              {stat('BMR', result.bmr, ' kcal')}
              {stat('Daily burn (TDEE)', result.tdee, ' kcal')}
            </Card>
            <Card>
              <Label>Suggested daily targets</Label>
              {stat('Calories', result.targetKcal, ' kcal')}
              {stat('Protein', result.proteinG, ' g')}
              {stat('Carbs', result.carbsG, ' g')}
              {stat('Fat', result.fatG, ' g')}
              {stat('Water', result.waterMl, ' ml')}
              <Txt variant="caption" tone="t3" className="mt-3">
                Estimates. Your trainer's plan overrides these.
              </Txt>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
