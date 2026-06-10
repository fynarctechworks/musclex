import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  ProgressRing,
  Screen,
  SegmentedControl,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { track } from '../src/analytics';
import { useDebouncedValue } from '../src/lib/use-debounced-value';
import {
  useNutritionToday,
  useLogMeal,
  useLogWater,
  useFoodSearch,
} from '../src/api/queries';
import type {
  MealType,
  NutritionMeal,
  NutritionTotals,
  NutritionGoal,
  FoodItem,
} from '../src/api/types';

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const WATER_PRESETS = [250, 500];

function r(n?: number): number {
  return Math.round(n ?? 0);
}

/** Macro consumed/target with a thin progress bar. */
function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <View className="flex-1">
      <View className="flex-row items-baseline justify-between">
        <Txt variant="caption" className="text-mute">
          {label}
        </Txt>
        <Txt variant="caption" className="text-body">
          {r(value)}/{r(target)}g
        </Txt>
      </View>
      <View className="mt-xs h-[6px] overflow-hidden rounded-full bg-surface-2">
        <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function NutritionScreen() {
  const theme = useThemeColors();
  const { data, isLoading, isError, refetch, isRefetching } = useNutritionToday();
  const logMeal = useLogMeal();
  const logWater = useLogWater();

  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    track({ name: 'screen_viewed', screen: 'nutrition' });
  }, []);

  const goal: NutritionGoal = data?.goal ?? {};
  const totals: NutritionTotals = data?.totals ?? {};
  const kcalGoal = goal.kcal ?? 0;
  const kcalEaten = totals.kcal ?? 0;
  const kcalLeft = Math.max(0, r(kcalGoal) - r(kcalEaten));
  const kcalRatio = kcalGoal > 0 ? Math.min(1, kcalEaten / kcalGoal) : 0;
  const over = kcalGoal > 0 && kcalEaten > kcalGoal;

  const waterMl = data?.waterMl ?? 0;
  const waterGoal = goal.waterMl ?? 0;
  const waterRatio = waterGoal > 0 ? Math.min(1, waterMl / waterGoal) : 0;
  const meals = data?.meals ?? [];

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      <View className="px-md pb-sm pt-md">
        <ScreenHeader title="Nutrition" className="mb-0" />
      </View>

      <View className="gap-md px-md">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : isError && !data ? (
          <Card>
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : (
          <>
            {/* Calories ring + macros */}
            <Card elevated>
              <View className="flex-row items-center">
                <ProgressRing
                  progress={kcalRatio}
                  size={104}
                  strokeWidth={10}
                  color={over ? theme.warning : theme.cyan}
                >
                  <View className="items-center">
                    <Txt variant="display-sm" weight="600" className="text-ink">
                      {over ? `+${r(kcalEaten) - r(kcalGoal)}` : kcalLeft}
                    </Txt>
                    <Txt variant="caption" className="text-mute">
                      {over ? 'OVER' : 'LEFT'}
                    </Txt>
                  </View>
                </ProgressRing>
                <View className="ml-lg flex-1">
                  <View className="flex-row items-center gap-xs">
                    <Icon name="flame" color={theme.warning} size={16} />
                    <Txt variant="caption" className="text-mute">
                      CALORIES
                    </Txt>
                  </View>
                  <Txt variant="body-lg" weight="600" className="mt-xxs text-ink">
                    {r(kcalEaten)} / {r(kcalGoal)} kcal
                  </Txt>
                  <View className="mt-md gap-sm">
                    <MacroBar label="Protein" value={totals.proteinG ?? 0} target={goal.proteinG ?? 0} color={theme.cyan} />
                    <MacroBar label="Carbs" value={totals.carbsG ?? 0} target={goal.carbsG ?? 0} color={theme.warning} />
                    <MacroBar label="Fat" value={totals.fatG ?? 0} target={goal.fatG ?? 0} color={theme.successFg} />
                  </View>
                </View>
              </View>
            </Card>

            {/* Water */}
            <Card>
              <View className="flex-row items-center justify-between">
                <Txt variant="caption" className="text-mute">
                  WATER
                </Txt>
                <Txt variant="body-sm" className="text-body">
                  {waterMl} / {waterGoal} ml
                </Txt>
              </View>
              <View className="mt-sm h-[8px] overflow-hidden rounded-full bg-surface-2">
                <View style={{ width: `${waterRatio * 100}%`, height: '100%', backgroundColor: theme.cyan }} />
              </View>
              <View className="mt-md flex-row gap-sm">
                {WATER_PRESETS.map((ml) => (
                  <View key={ml} className="flex-1">
                    <Button
                      title={`+${ml} ml`}
                      variant="secondary"
                      size="md"
                      fullWidth
                      loading={logWater.isPending}
                      onPress={() => {
                        logWater.mutate({ amountMl: ml });
                        track({ name: 'nutrition_water_logged', amountMl: ml });
                      }}
                    />
                  </View>
                ))}
              </View>
            </Card>

            {/* Meals */}
            <View className="mt-xs flex-row items-center justify-between">
              <Txt variant="caption" className="text-mute">
                MEALS
              </Txt>
              <Button title="Log meal" size="sm" onPress={() => setSheetOpen(true)} />
            </View>

            {meals.length === 0 ? (
              <Card>
                <EmptyState
                  compact
                  icon="flame"
                  title="Nothing logged yet"
                  message="Log your first meal to start tracking calories and macros today."
                  actionLabel="Log meal"
                  onAction={() => setSheetOpen(true)}
                />
              </Card>
            ) : (
              <View className="gap-md">
                {[...meals]
                  .sort(
                    (a, b) =>
                      MEAL_ORDER.indexOf(a.mealType ?? 'snack') -
                      MEAL_ORDER.indexOf(b.mealType ?? 'snack'),
                  )
                  .map((m) => (
                    <MealCard key={m.id} meal={m} />
                  ))}
              </View>
            )}
          </>
        )}

        <View className="h-2xl" />
      </View>

      <LogMealSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        pending={logMeal.isPending}
        onSubmit={async (mealType, item) => {
          await logMeal.mutateAsync({ mealType, items: [item] });
          track({
            name: 'nutrition_meal_logged',
            mealType,
            kcal: item.kcal,
            viaSearch: item.foodItemId != null,
          });
          setSheetOpen(false);
        }}
      />
    </Screen>
  );
}

function MealCard({ meal }: { meal: NutritionMeal }) {
  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Txt variant="body-lg" weight="600" className="text-ink">
          {MEAL_LABEL[meal.mealType ?? 'snack']}
        </Txt>
        <Txt variant="body-sm" weight="500" className="text-body">
          {r(meal.totals?.kcal)} kcal
        </Txt>
      </View>
      <View className="mt-sm gap-xs">
        {(meal.items ?? []).map((it) => (
          <View key={it.id} className="flex-row items-center justify-between">
            <Txt variant="body-sm" className="flex-1 pr-md text-body">
              {it.name}
              {it.quantity && it.quantity !== 1 ? ` ×${it.quantity}` : ''}
            </Txt>
            <Txt variant="caption" className="text-mute">
              {r(it.kcal)} kcal
            </Txt>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Search-first meal entry: type to search the gym food catalog, tap a result to
 * prefill macros (minimal typing), or enter a custom food manually. */
function LogMealSheet({
  open,
  onClose,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (
    mealType: MealType,
    item: {
      foodItemId?: string | null;
      name: string;
      quantity: number;
      unit: string;
      kcal: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    },
  ) => void;
}) {
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [query, setQuery] = useState('');
  const [foodItemId, setFoodItemId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);
  const search = useFoodSearch(debouncedQuery);
  const results = debouncedQuery.trim().length >= 2 ? search.data?.foods ?? [] : [];

  function num(s: string): number {
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function pickFood(f: FoodItem) {
    setFoodItemId(f.id ?? null);
    setName(f.name ?? '');
    setKcal(f.kcal != null ? String(f.kcal) : '');
    setProtein(f.proteinG != null ? String(f.proteinG) : '');
    setCarbs(f.carbsG != null ? String(f.carbsG) : '');
    setFat(f.fatG != null ? String(f.fatG) : '');
    setQuery('');
    setError(null);
    track({ name: 'nutrition_food_selected', food: f.name ?? '' });
  }

  function reset() {
    setQuery('');
    setFoodItemId(null);
    setName('');
    setKcal('');
    setProtein('');
    setCarbs('');
    setFat('');
    setError(null);
  }

  function save() {
    if (!name.trim()) {
      setError('Search a food or type a name.');
      return;
    }
    setError(null);
    onSubmit(mealType, {
      foodItemId,
      name: name.trim(),
      quantity: 1,
      unit: 'serving',
      kcal: num(kcal),
      proteinG: num(protein),
      carbsG: num(carbs),
      fatG: num(fat),
    });
    reset();
  }

  return (
    <BottomSheet visible={open} onClose={onClose} title="Log a meal">
      <SegmentedControl
        value={mealType}
        onChange={setMealType}
        options={MEAL_ORDER.map((m) => ({ label: MEAL_LABEL[m], value: m }))}
      />

      {/* Search the gym food catalog → tap to prefill macros. */}
      <View className="mt-md">
        <Input
          label="Search food"
          placeholder="e.g. dal, paneer, chicken"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setFoodItemId(null);
          }}
          autoCapitalize="none"
        />
      </View>
      {results.length > 0 ? (
        <View className="mt-xs overflow-hidden rounded-md border border-hairline bg-surface">
          {results.slice(0, 6).map((f, i) => (
            <Pressable
              key={f.id}
              onPress={() => pickFood(f)}
              accessibilityRole="button"
              accessibilityLabel={`${f.name}, ${r(f.kcal)} kcal`}
              className={`flex-row items-center justify-between px-md py-sm ${
                i > 0 ? 'border-t border-hairline' : ''
              }`}
            >
              <Txt variant="body-sm" className="flex-1 pr-md text-ink" numberOfLines={1}>
                {f.name}
              </Txt>
              <Txt variant="caption" className="text-mute">
                {r(f.kcal)} kcal
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Selected food / manual entry. */}
      <View className="mt-md">
        <Input
          label="Food"
          placeholder="Tap a result above or type"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setFoodItemId(null);
          }}
          error={error ?? undefined}
        />
      </View>
      <View className="mt-md">
        <Input label="Calories (kcal)" keyboardType="decimal-pad" placeholder="320" value={kcal} onChangeText={setKcal} />
      </View>
      <View className="mt-md flex-row gap-sm">
        <View className="flex-1">
          <Input label="Protein (g)" keyboardType="decimal-pad" placeholder="18" value={protein} onChangeText={setProtein} />
        </View>
        <View className="flex-1">
          <Input label="Carbs (g)" keyboardType="decimal-pad" placeholder="12" value={carbs} onChangeText={setCarbs} />
        </View>
        <View className="flex-1">
          <Input label="Fat (g)" keyboardType="decimal-pad" placeholder="22" value={fat} onChangeText={setFat} />
        </View>
      </View>
      <View className="mt-lg">
        <Button title="Add to log" fullWidth loading={pending} onPress={save} />
      </View>
    </BottomSheet>
  );
}
