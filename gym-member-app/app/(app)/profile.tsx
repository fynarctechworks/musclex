import { Alert, Pressable, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Icon, Screen, Txt, colors } from '../../src/design-system';
import { useAuth } from '../../src/auth/auth-store';
import { usePrefs } from '../../src/auth/prefs-store';
import { useMe } from '../../src/api/queries';
import type { Goal } from '../../src/api/types';

const GOAL_LABEL: Record<Goal, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  general_fitness: 'Stay fit',
};

function Row({
  label,
  value,
  onPress,
  right,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between border-b border-hairline px-md py-md"
    >
      <Txt
        variant="body-md"
        className={destructive ? 'text-error' : 'text-ink'}
      >
        {label}
      </Txt>
      <View className="flex-row items-center gap-xs">
        {value ? <Txt variant="body-sm" className="text-mute">{value}</Txt> : null}
        {right ?? (onPress ? <Icon name="chevron-right" color={colors.mute} size={18} /> : null)}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data: me } = useMe();
  const storedProfile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const goal = usePrefs((s) => s.goal);
  const level = usePrefs((s) => s.experienceLevel);
  const biometricEnabled = usePrefs((s) => s.biometricEnabled);
  const setOnboarding = usePrefs((s) => s.setOnboarding);

  const profile = me ?? storedProfile;

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You can sign back in with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  function dataRequest(kind: 'export' | 'delete') {
    // DPDP Act 2023 rights (TRD §10). Phase-1 stub: surface intent; the BFF flow
    // is deferred. Keep the entry point visible so the right exists.
    Alert.alert(
      kind === 'export' ? 'Export my data' : 'Delete my account',
      'This request will be sent to your gym. Full self-service flow is coming soon.',
    );
  }

  return (
    <Screen scroll>
      <View className="pt-md">
        {/* Identity header */}
        <View className="items-center py-lg">
          <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-surface-2">
            <Txt variant="display-md" weight="600" className="text-ink">
              {(profile?.name ?? '?').slice(0, 1).toUpperCase()}
            </Txt>
          </View>
          <Txt variant="display-sm" weight="600" className="mt-md text-ink">
            {profile?.name ?? 'Member'}
          </Txt>
          <Txt variant="body-sm" className="text-mute">
            {profile?.phone ?? ''}
          </Txt>
          {profile?.gymName ? (
            <Txt variant="body-sm" className="mt-xxs text-body">
              {profile.gymName}
            </Txt>
          ) : null}
        </View>

        {/* Fitness profile */}
        <Txt variant="caption" className="mb-xs ml-md text-mute">
          FITNESS PROFILE
        </Txt>
        <Card noPadding>
          <Row
            label="Goal"
            value={goal ? GOAL_LABEL[goal] : profile?.goal ? GOAL_LABEL[profile.goal] : 'Not set'}
          />
          <Row label="Experience" value={level ?? 'Not set'} />
        </Card>

        {/* Settings */}
        <Txt variant="caption" className="mb-xs ml-md mt-lg text-mute">
          SETTINGS
        </Txt>
        <Card noPadding>
          <Row label="Notifications" onPress={() => router.push('/notifications')} />
          <Row
            label="Unlock with biometrics"
            right={
              <Switch
                value={biometricEnabled}
                onValueChange={(v) => setOnboarding({ biometricEnabled: v })}
                trackColor={{ true: colors.successFg, false: colors.surface2 }}
              />
            }
          />
        </Card>

        {/* Privacy (DPDP) */}
        <Txt variant="caption" className="mb-xs ml-md mt-lg text-mute">
          PRIVACY
        </Txt>
        <Card noPadding>
          <Row label="Export my data" onPress={() => dataRequest('export')} />
          <Row label="Delete my account" destructive onPress={() => dataRequest('delete')} />
        </Card>

        <View className="mt-lg">
          <Card noPadding>
            <Row label="Sign out" destructive onPress={confirmSignOut} />
          </Card>
        </View>

        <Txt variant="caption" className="mt-lg text-center text-mute">
          FitSync v0.1.0
        </Txt>
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
