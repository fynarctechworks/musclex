import { View } from 'react-native';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonCard,
  Txt,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useMyPlans } from '../src/api/queries';
import { useCapabilities } from '../src/auth/use-capabilities';
import { formatDate } from '../src/lib/format';
import type { DietPlanMeal, MealType } from '../src/api/types';

/** Fixed display order for meal groups. */
const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/**
 * The meal `items` column is trainer-entered free-form JSON (an array of
 * { food, quantity, … } rows). Normalize defensively to printable lines —
 * never trust the shape.
 */
function mealItemLines(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (typeof it === 'string') return it;
      if (it && typeof it === 'object') {
        const o = it as Record<string, unknown>;
        const food =
          typeof o.food === 'string'
            ? o.food
            : typeof o.name === 'string'
              ? o.name
              : null;
        if (!food) return null;
        const qty =
          typeof o.quantity === 'string' || typeof o.quantity === 'number'
            ? String(o.quantity)
            : null;
        return qty ? `${food} — ${qty}` : food;
      }
      return null;
    })
    .filter((x): x is string => !!x);
}

/** Group + sort meals: breakfast → lunch → dinner → snack, then by position. */
function groupMeals(meals: DietPlanMeal[]): { type: MealType; meals: DietPlanMeal[] }[] {
  return MEAL_ORDER.map((type) => ({
    type,
    meals: meals
      .filter((m) => m.meal_type === type)
      .sort((a, b) => a.position - b.position),
  })).filter((g) => g.meals.length > 0);
}

function MacroStat({ label, value }: { label: string; value: number | null }) {
  return (
    <View className="flex-1 items-center">
      <Txt variant="body-lg" weight="600" className="text-ink">
        {value != null ? `${value}g` : '—'}
      </Txt>
      <Txt variant="caption" className="text-mute">
        {label}
      </Txt>
    </View>
  );
}

/**
 * My Plan — the trainer-prescribed diet plan (with meals) and the next 7 days
 * of assigned workouts. Read-only, gym-members only.
 */
export default function PlanScreen() {
  const { isMember } = useCapabilities();
  const { data, isLoading, isError, refetch, isRefetching } = useMyPlans(isMember);

  const diet = data?.diet_plan ?? null;
  const workouts = data?.upcoming_workouts ?? [];
  const mealGroups = diet ? groupMeals(diet.plan.meals) : [];

  return (
    <Screen scroll onRefresh={isMember ? refetch : undefined} refreshing={isRefetching}>
      <View className="pt-md">
        <ScreenHeader title="My Plan" />

        {!isMember ? (
          <Card className="mt-lg">
            <EmptyState
              compact
              icon="users"
              title="Join a gym to unlock"
              message="Trainer-assigned diet and workout plans are available once you're a gym member."
            />
          </Card>
        ) : isLoading ? (
          <View className="mt-lg gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError && !data ? (
          <Card className="mt-lg">
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : !diet && workouts.length === 0 ? (
          <Card className="mt-lg">
            <EmptyState
              compact
              icon="calendar"
              title="No plan yet"
              message="Your trainer hasn't assigned a plan yet. Check back soon — or ask them at your next session."
            />
          </Card>
        ) : (
          <>
            {/* ── Diet plan ── */}
            {diet ? (
              <>
                <Card elevated className="mt-md">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-md">
                      <Txt variant="display-md" weight="600" className="text-ink">
                        {diet.plan.title}
                      </Txt>
                      {diet.plan.description ? (
                        <Txt variant="body-sm" className="mt-xxs text-body">
                          {diet.plan.description}
                        </Txt>
                      ) : null}
                    </View>
                    {diet.plan.goal ? (
                      <Badge label={diet.plan.goal.replace(/_/g, ' ').toUpperCase()} tone="accent" />
                    ) : null}
                  </View>

                  {/* Daily calories + macro row */}
                  <View className="mt-lg flex-row items-center rounded-2xl bg-surface-2 px-md py-md">
                    <View className="flex-1 items-center">
                      <Txt variant="body-lg" weight="600" className="text-ink">
                        {diet.plan.daily_calories != null ? diet.plan.daily_calories : '—'}
                      </Txt>
                      <Txt variant="caption" className="text-mute">
                        kcal / day
                      </Txt>
                    </View>
                    <MacroStat label="Protein" value={diet.plan.protein_g} />
                    <MacroStat label="Carbs" value={diet.plan.carbs_g} />
                    <MacroStat label="Fat" value={diet.plan.fat_g} />
                  </View>

                  <View className="mt-md gap-xxs">
                    <Txt variant="caption" className="text-mute">
                      {`${formatDate(diet.starts_on)}${diet.ends_on ? ` → ${formatDate(diet.ends_on)}` : ' onwards'}`}
                      {diet.assigned_by ? `  ·  Assigned by ${diet.assigned_by}` : ''}
                    </Txt>
                    {diet.notes ? (
                      <Txt variant="body-sm" className="text-body">
                        {diet.notes}
                      </Txt>
                    ) : null}
                  </View>
                </Card>

                {/* Meals grouped by type */}
                {mealGroups.map((group) => (
                  <View key={group.type}>
                    <Txt variant="caption" className="mb-sm mt-lg text-mute">
                      {MEAL_LABEL[group.type].toUpperCase()}
                    </Txt>
                    <View className="gap-sm">
                      {group.meals.map((meal) => {
                        const lines = mealItemLines(meal.items);
                        return (
                          <Card key={meal.id} soft>
                            <View className="flex-row items-center justify-between">
                              <Txt
                                variant="body-md"
                                weight="600"
                                className="flex-1 pr-sm text-ink"
                              >
                                {meal.title}
                              </Txt>
                              {meal.calories != null ? (
                                <Txt variant="body-sm" weight="500" className="text-body">
                                  {meal.calories} kcal
                                </Txt>
                              ) : null}
                            </View>
                            {lines.length > 0 ? (
                              <View className="mt-xs gap-xxs">
                                {lines.map((line, i) => (
                                  <Txt key={i} variant="body-sm" className="text-body">
                                    {`•  ${line}`}
                                  </Txt>
                                ))}
                              </View>
                            ) : null}
                            {meal.notes ? (
                              <Txt variant="caption" className="mt-xs text-mute">
                                {meal.notes}
                              </Txt>
                            ) : null}
                          </Card>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <Card soft className="mt-md">
                <Txt variant="body-sm" className="text-mute">
                  No diet plan assigned yet.
                </Txt>
              </Card>
            )}

            {/* ── Upcoming workouts ── */}
            <Txt variant="caption" className="mb-sm mt-lg text-mute">
              UPCOMING WORKOUTS
            </Txt>
            {workouts.length === 0 ? (
              <Card soft>
                <Txt variant="body-sm" className="text-mute">
                  No workouts scheduled for the next 7 days.
                </Txt>
              </Card>
            ) : (
              <View className="gap-sm">
                {workouts.map((w) => (
                  <Card key={w.assignment_id} soft>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-sm">
                        <Txt variant="caption" className="text-mute">
                          {formatDate(w.scheduled_date)}
                        </Txt>
                        <Txt variant="body-md" weight="600" className="mt-xxs text-ink">
                          {w.plan.title}
                        </Txt>
                        <Txt variant="body-sm" className="mt-xxs text-body">
                          {[
                            w.plan.difficulty,
                            `${w.plan.exercise_count} exercise${w.plan.exercise_count === 1 ? '' : 's'}`,
                          ]
                            .filter(Boolean)
                            .join('  ·  ')}
                        </Txt>
                      </View>
                      <Badge
                        label={w.status === 'completed' ? 'COMPLETED' : 'ASSIGNED'}
                        tone={w.status === 'completed' ? 'success' : 'neutral'}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
