import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Dialog,
  Icon,
  Screen,
  Txt,
  useThemeColors,
} from '../../src/design-system';
import { useAuth } from '../../src/auth/auth-store';
import { usePrefs } from '../../src/auth/prefs-store';
import { useMe, useMembership, qk } from '../../src/api/queries';
import { useCapabilities } from '../../src/auth/use-capabilities';
import { pickAndUploadAvatar } from '../../src/features/profile/avatar-upload';
import { GymSuspendedBanner } from '../../src/features/gym/GymSuspendedBanner';
import { notify } from '../../src/lib/confirm';
import type { Membership, MembershipStatus } from '../../src/api/types';

type Link = { label: string; onPress: () => void; danger?: boolean };
type Group = { title: string; links: Link[] };

const STATUS: Record<MembershipStatus, { label: string; color: string }> = {
  active: { label: 'ACTIVE', color: '#2FD08A' },
  expiring: { label: 'EXPIRING', color: '#F5A623' },
  frozen: { label: 'FROZEN', color: '#F5A623' },
  expired: { label: 'EXPIRED', color: '#FF5A5F' },
};

/**
 * Profile tab — a cult.fit-inspired hub. A profile hero, the membership shown as a
 * dark "card" (kept dark in both themes for the premium card feel), then the app's
 * features organised into the reference's grouped, dot-separated link sections —
 * mapped to MuscleX's real screens (no dead links).
 */
export default function ProfileScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { data: me } = useMe();
  const { data: membership } = useMembership();
  const storedProfile = useAuth((s) => s.profile);
  const city = useAuth((s) => s.context?.city ?? null);
  const signOut = useAuth((s) => s.signOut);
  const setProfile = useAuth((s) => s.setProfile);
  const { isMember } = useCapabilities();
  const themeMode = usePrefs((s) => s.themeMode);
  const setThemeMode = usePrefs((s) => s.setThemeMode);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const qc = useQueryClient();

  const profile = me ?? storedProfile;
  const go = (route: string) => () => router.push(route as never);

  const onChangeAvatar = async () => {
    if (uploadingAvatar) return;
    try {
      setUploadingAvatar(true);
      const url = await pickAndUploadAvatar();
      if (url) {
        // Refresh the profile so the new photo shows everywhere it's read.
        await qc.invalidateQueries({ queryKey: qk.me });
        qc.invalidateQueries({ queryKey: qk.home });
        // Update the stored profile too — the Home header reads it directly.
        const base = me ?? storedProfile;
        if (base) setProfile({ ...base, avatarUrl: url });
      }
    } catch (e) {
      notify('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Feature groups — the reference's structure, mapped to real MuscleX routes.
  const groups: Group[] = [
    {
      title: 'Activity & Records',
      links: [
        { label: 'Statistics', onPress: go('/statistic') },
        { label: 'Progress', onPress: go('/progress') },
        { label: 'Activity', onPress: go('/activity') },
        { label: 'Badges', onPress: go('/rewards') },
        { label: 'Nutrition', onPress: go('/nutrition') },
      ],
    },
    {
      title: 'Account Settings',
      links: [
        { label: 'Notifications', onPress: go('/notifications') },
        { label: 'Account & security', onPress: go('/settings/account-security') },
        { label: 'Fitness profile', onPress: go('/settings/fitness-profile') },
        { label: 'Goals', onPress: go('/settings/goals') },
        { label: themeMode === 'dark' ? 'Light mode' : 'Dark mode', onPress: () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark') },
      ],
    },
    {
      title: 'Fitness & Devices',
      links: [
        { label: 'Health', onPress: go('/health') },
        { label: 'Heart', onPress: go('/heart') },
        { label: 'Sleep', onPress: go('/sleep') },
        { label: 'Body', onPress: go('/body') },
      ],
    },
    {
      title: 'Explore',
      links: [
        ...(isMember
          ? [
              { label: 'Classes', onPress: go('/classes') },
              { label: 'Workouts', onPress: go('/workout') },
              { label: 'Community', onPress: go('/community') },
            ]
          : []),
        { label: 'Exercises', onPress: go('/exercises') },
        { label: 'Find gyms', onPress: go('/gyms') },
        { label: 'Mindfulness', onPress: go('/mindfulness') },
      ],
    },
    {
      title: 'Referral, Rewards & More',
      links: [
        { label: 'Refer a friend', onPress: go('/referral') },
        { label: 'Rewards', onPress: go('/rewards') },
        { label: 'All features', onPress: go('/menu') },
        { label: 'Tools', onPress: go('/tools') },
        { label: 'Locations', onPress: go('/locations') },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Notifications', onPress: go('/notifications') },
        { label: 'Check in', onPress: go('/checkin') },
        { label: 'Sign out', onPress: () => setSignOutVisible(true), danger: true },
      ],
    },
  ];

  return (
    <Screen scroll>
      {/* Hero — avatar, name, view-profile / city row. */}
      <View className="items-center pb-md pt-lg">
        {/* Avatar — editable only for gym members (the photo syncs to the admin
            member record; public/gym-less users have no such record). */}
        <Pressable
          onPress={isMember ? onChangeAvatar : undefined}
          disabled={!isMember || uploadingAvatar}
          hitSlop={8}
          accessibilityRole={isMember ? 'button' : undefined}
          accessibilityLabel={isMember ? 'Change profile photo' : undefined}
        >
          <Avatar name={profile?.name} uri={profile?.avatarUrl} size={88} />
          {isMember && (
            <View
              className="absolute bottom-0 right-0 items-center justify-center rounded-full border-2 border-bg bg-primary"
              style={{ height: 30, width: 30 }}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <Icon name="camera" color={theme.onPrimary} size={15} />
              )}
            </View>
          )}
        </Pressable>
        <Txt variant="display-lg" weight="600" className="mt-md text-ink">
          {profile?.name ?? 'Member'}
        </Txt>
        <View className="mt-sm flex-row items-center">
          <Pressable
            onPress={go('/settings/fitness-profile')}
            className="flex-row items-center gap-xs px-md"
            hitSlop={8}
            accessibilityLabel="View profile"
          >
            <Icon name="user" color={theme.body} size={16} />
            <Txt variant="caption" weight="600" className="text-body">
              VIEW PROFILE
            </Txt>
          </Pressable>
          <View style={{ width: 1, height: 16, backgroundColor: theme.hairline }} />
          <Pressable
            onPress={go('/locations')}
            className="flex-row items-center gap-xs px-md"
            hitSlop={8}
            accessibilityLabel="Locations"
          >
            <Icon name="pin" color={theme.body} size={16} />
            <Txt variant="caption" weight="600" className="text-body">
              {(city ?? profile?.gymName ?? 'Locations').toUpperCase()}
            </Txt>
          </Pressable>
        </View>
      </View>

      <GymSuspendedBanner />

      {/* Membership card — dark in both themes for the premium "card" feel. */}
      <MembershipCard membership={membership} onPress={isMember ? go('/membership') : go('/gyms')} theme={theme} isMember={isMember} />

      {/* Feature groups */}
      <View className="mt-xl gap-xl">
        {groups.map((g) => (
          <LinkGroup key={g.title} group={g} theme={theme} />
        ))}
      </View>

      <Txt variant="caption" className="mt-xl text-center text-mute">
        MuscleX v0.1.0
      </Txt>
      <View className="h-2xl" />

      <Dialog visible={signOutVisible} onClose={() => setSignOutVisible(false)} title="Sign out?">
        <Txt variant="body-md" className="mb-lg text-body">
          You can sign back in with your phone number.
        </Txt>
        <View className="gap-sm">
          <Button
            title="Sign out"
            variant="danger"
            fullWidth
            onPress={() => {
              setSignOutVisible(false);
              void signOut();
            }}
          />
          <Button title="Cancel" variant="ghost" fullWidth onPress={() => setSignOutVisible(false)} />
        </View>
      </Dialog>
    </Screen>
  );
}

function MembershipCard({
  membership,
  onPress,
  theme,
  isMember,
}: {
  membership: Membership | undefined;
  onPress: () => void;
  theme: ReturnType<typeof useThemeColors>;
  isMember: boolean;
}) {
  const CARD_BG = '#16181F'; // fixed dark — a physical-card look on any theme
  const CARD_INK = '#FFFFFF';
  const CARD_MUTE = 'rgba(255,255,255,0.6)';

  // No gym membership (public user) → a join CTA in the same card shell.
  if (!isMember || !membership?.status) {
    return (
      <Pressable onPress={onPress} accessibilityLabel="Join a gym">
        <View className="overflow-hidden rounded-2xl p-lg" style={{ backgroundColor: CARD_BG }}>
          <Txt variant="caption" weight="600" style={{ color: theme.primary }}>
            NO ACTIVE MEMBERSHIP
          </Txt>
          <Txt variant="display-sm" weight="600" className="mt-xs" style={{ color: CARD_INK }}>
            Join a gym
          </Txt>
          <Txt variant="body-sm" className="mt-xxs" style={{ color: CARD_MUTE }}>
            Unlock classes, trainers & check-ins
          </Txt>
        </View>
      </Pressable>
    );
  }

  const s = STATUS[membership.status];
  const expired = membership.status === 'expired';
  const planName = membership.plan?.name ?? 'Membership';
  // Status bar (not a live countdown): full width, tinted by membership status.
  const barColor = expired || membership.status === 'expiring' ? '#FF5A5F' : '#2FD08A';

  return (
    <Pressable onPress={onPress} accessibilityLabel="Membership">
      <View className="overflow-hidden rounded-2xl p-lg" style={{ backgroundColor: CARD_BG }}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-md">
            <View className="mb-sm flex-row items-center gap-xs">
              <View style={{ width: 3, height: 14, backgroundColor: s.color }} />
              <Txt variant="caption" weight="600" style={{ color: s.color }}>
                {s.label}
              </Txt>
            </View>
            <Txt variant="display-sm" weight="600" style={{ color: CARD_INK }}>
              {planName}
            </Txt>
          </View>
          {/* Faint brand mark, top-right (like the reference glyph). */}
          <Icon name="flash" color={'rgba(255,255,255,0.18)'} size={44} filled />
        </View>

        {membership.expiresOn ? (
          <Txt variant="body-sm" className="mt-xl" style={{ color: CARD_MUTE }}>
            {`${expired ? 'Ended on' : 'Renews on'} ${membership.expiresOn}`}
          </Txt>
        ) : null}

        {/* Status bar */}
        <View className="mt-sm h-[6px] overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <View style={{ width: '100%', height: '100%', backgroundColor: barColor }} />
        </View>
      </View>
    </Pressable>
  );
}

/** A reference-style group: bold title + a wrapped row of dot-separated links. */
function LinkGroup({ group, theme }: { group: Group; theme: ReturnType<typeof useThemeColors> }) {
  return (
    <View>
      <Txt variant="display-sm" weight="600" className="mb-sm text-ink">
        {group.title}
      </Txt>
      <View className="flex-row flex-wrap items-center">
        {group.links.map((l, i) => (
          <View key={l.label} className="flex-row items-center">
            {i > 0 ? <Txt variant="body-md" style={{ color: theme.hairlineStrong }} className="px-xs">•</Txt> : null}
            <Pressable onPress={l.onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={l.label}>
              <Txt variant="body-md" style={{ color: l.danger ? theme.error : theme.body }}>
                {l.label}
              </Txt>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
