import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { dayOf } from '../src/lib/datetime';
import { useMyPlan } from '../src/api/queries';
import { Icon } from '../src/ui/Icon';

/**
 * MY PLAN — what the trainer has set: the diet plan, and the workouts scheduled
 * ahead. Today's session is on the Today tab; this is the week around it, so a
 * member can see what is coming rather than discovering it each morning.
 */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useMyPlan();

  if (isLoading) return <Loading label="Loading your plan" />;

  const upcoming = data?.upcoming_workouts ?? [];
  const diet = data?.diet_plan ?? null;

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="My plan" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        <Card>
          <Label>Scheduled workouts</Label>
          {upcoming.length === 0 ? (
            <Txt variant="small" tone="t2" className="mt-3">
              Your trainer has not scheduled anything yet.
            </Txt>
          ) : (
            upcoming.map((w) => {
              const done = w.status === 'completed';
              return (
                <Row key={w.assignment_id} className="mt-4 items-start">
                  <View className="flex-1 pr-3">
                    <Txt variant="bodyStrong">{w.plan.title}</Txt>
                    <Txt variant="caption" tone="t3" className="mt-0.5">
                      {dayOf(w.scheduled_date)}
                      {w.plan.exercise_count ? ` · ${w.plan.exercise_count} exercises` : ''}
                      {w.plan.difficulty ? ` · ${w.plan.difficulty}` : ''}
                    </Txt>
                  </View>
                  <Row className="justify-start gap-1">
                    {done ? <Icon name="check" size={13} tone="good" decorative /> : null}
                    <Txt variant="caption" tone={done ? 'good' : 't3'} className="font-semibold">
                      {done ? 'done' : w.status}
                    </Txt>
                  </Row>
                </Row>
              );
            })
          )}
        </Card>

        <Card>
          <Label>Diet plan</Label>
          {diet ? (
            <>
              <Txt variant="heading" className="mt-2">
                {diet.title ?? 'Your plan'}
              </Txt>
              {diet.notes ? (
                <Txt variant="small" tone="t2" className="mt-2 leading-relaxed">
                  {diet.notes}
                </Txt>
              ) : null}
              {(diet.meals ?? []).map((m, i) => (
                <View key={i} className="mt-3">
                  <Txt variant="bodyStrong">{m.name}</Txt>
                  <Txt variant="caption" tone="t3" className="mt-0.5">
                    {(m.items ?? []).join(', ')}
                    {m.kcal ? ` · ${m.kcal} kcal` : ''}
                  </Txt>
                </View>
              ))}
            </>
          ) : (
            <Txt variant="small" tone="t2" className="mt-3">
              No diet plan set. Ask your trainer if you want one.
            </Txt>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
