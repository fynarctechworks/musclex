import { Alert, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Card, ListRow, Screen, Txt, colors } from '../src/design-system';
import { useAuth } from '../src/auth/auth-store';
import { usePrefs } from '../src/auth/prefs-store';
import { useMe } from '../src/api/queries';
import type { ExperienceLevel, Goal } from '../src/api/types';

const GOAL_LABEL: Record<Goal, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  general_fitness: 'Stay fit',
};

const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/**
 * Profile (BLUEPRINT.md §5 — Profile section, off the tab bar, reached from the
 * Home header). Hosts identity, fitness profile, settings, privacy and sign-out.
 */
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
          <Avatar name={profile?.name} size={72} />
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
          <ListRow
            label="Goal"
            value={goal ? GOAL_LABEL[goal] : profile?.goal ? GOAL_LABEL[profile.goal] : 'Not set'}
          />
          <ListRow label="Experience" value={level ? EXPERIENCE_LABEL[level] : 'Not set'} last />
        </Card>

        {/* Settings */}
        <Txt variant="caption" className="mb-xs ml-md mt-lg text-mute">
          SETTINGS
        </Txt>
        <Card noPadding>
          <ListRow label="Gym locations" onPress={() => router.push('/locations')} />
          <ListRow label="Notifications" onPress={() => router.push('/notifications')} />
          <ListRow
            label="Unlock with biometrics"
            last
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
          <ListRow label="Export my data" onPress={() => dataRequest('export')} />
          <ListRow label="Delete my account" destructive onPress={() => dataRequest('delete')} last />
        </Card>

        <View className="mt-lg">
          <Card noPadding>
            <ListRow label="Sign out" destructive onPress={confirmSignOut} last />
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
