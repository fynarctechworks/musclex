import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Screen, Txt, colors } from '../../src/design-system';
import { usePrefs } from '../../src/auth/prefs-store';
import { useAuth } from '../../src/auth/auth-store';
import type { ExperienceLevel, Goal } from '../../src/api/types';

const GOALS: { key: Goal; label: string; emoji: string }[] = [
  { key: 'lose_fat', label: 'Lose fat', emoji: '🔥' },
  { key: 'build_muscle', label: 'Build muscle', emoji: '💪' },
  { key: 'general_fitness', label: 'Stay fit', emoji: '⚡' },
];

const LEVELS: { key: ExperienceLevel; label: string; body: string }[] = [
  { key: 'beginner', label: 'Beginner', body: 'New to training' },
  { key: 'intermediate', label: 'Intermediate', body: 'Train regularly' },
  { key: 'advanced', label: 'Advanced', body: 'Years under the bar' },
];

function Option({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg border p-md ${
        selected ? 'border-cyan bg-surface-2' : 'border-hairline bg-surface'
      }`}
    >
      {children}
    </Pressable>
  );
}

export default function GoalScreen() {
  const name = useAuth((s) => s.profile?.name);
  const complete = usePrefs((s) => s.completeOnboarding);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const ready = !!goal && !!level;

  async function onFinish() {
    if (!goal || !level) return;
    setSaving(true);
    await complete(goal, level);
    // AuthGate redirects into the app once `onboarded` flips true.
  }

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View className="pt-2xl">
        <Txt variant="display-lg" weight="600" className="text-ink">
          {name ? `Welcome, ${name.split(' ')[0]}.` : 'Welcome.'}
        </Txt>
        <Txt variant="body-md" className="mt-xs mb-xl text-body">
          Two quick questions so we can tailor your plan.
        </Txt>

        <Txt variant="body-sm" weight="500" className="mb-sm text-ink">
          {'What’s your main goal?'}
        </Txt>
        <View className="mb-xl flex-row gap-sm">
          {GOALS.map((g) => (
            <View key={g.key} className="flex-1">
              <Option selected={goal === g.key} onPress={() => setGoal(g.key)}>
                <Txt variant="display-sm" className="text-center">
                  {g.emoji}
                </Txt>
                <Txt
                  variant="body-sm"
                  weight="500"
                  className="mt-xs text-center text-ink"
                >
                  {g.label}
                </Txt>
              </Option>
            </View>
          ))}
        </View>

        <Txt variant="body-sm" weight="500" className="mb-sm text-ink">
          Your experience level?
        </Txt>
        <View className="gap-sm">
          {LEVELS.map((l) => (
            <Option
              key={l.key}
              selected={level === l.key}
              onPress={() => setLevel(l.key)}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Txt variant="body-md" weight="500" className="text-ink">
                    {l.label}
                  </Txt>
                  <Txt variant="caption" className="text-mute">
                    {l.body}
                  </Txt>
                </View>
                <View
                  className="h-[20px] w-[20px] rounded-full border-2"
                  style={{
                    borderColor: level === l.key ? colors.cyan : colors.hairlineStrong,
                    backgroundColor: level === l.key ? colors.cyan : 'transparent',
                  }}
                />
              </View>
            </Option>
          ))}
        </View>

        <View className="h-2xl" />
        <Button
          title="Enter FitSync"
          fullWidth
          disabled={!ready}
          loading={saving}
          onPress={onFinish}
        />
      </View>
    </Screen>
  );
}
