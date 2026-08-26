import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Icon, Label, Loading, Row, Txt, type IconName } from '../../src/ui';
import { color, space } from '../../src/ui/theme';
import { useHome, useMe, usePending } from '../../src/api/queries';
import { Confirm } from '../../src/ui/Notice';
import { useSession } from '../../src/session';

function Link({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Row style={{ paddingVertical: space.md, gap: space.md }}>
        <Icon name={icon} size={20} tone="t3" decorative />
        <View style={{ flex: 1 }}>
          <Txt variant="body">{label}</Txt>
          {hint ? (
            <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>{hint}</Txt>
          ) : null}
        </View>
        <Icon name="chevron" size={16} tone="t4" decorative />
      </Row>
    </Pressable>
  );
}

/** Tab bar height plus the raised action button that sits above it. The
 *  device's own home-indicator inset is added on top at render. */
const TAB_BAR_CLEARANCE = 108;

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const { data: home } = useHome();
  const { data: pending } = usePending();
  const { signOut } = useSession();
  const [confirming, setConfirming] = useState(false);

  if (isLoading || !me) return <Loading label="Loading profile" />;

  const line = (k: string, v?: string | number | null) => (
    <Row style={{ marginTop: space.md }}>
      <Txt variant="small" tone="t2">{k}</Txt>
      <Txt variant="bodyStrong">{v ?? '--'}</Txt>
    </Row>
  );

  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.lg,
        paddingTop: insets.top + space.md,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space.md,
      }}
    >
      <View>
        <Txt variant="title">{me.name}</Txt>
        <Txt variant="small" tone="t2" style={{ marginTop: 4 }}>{me.gymName}</Txt>
      </View>

      <Card>
        <Label>More</Label>
        <Link icon="exercises" label="Explore" hint="Ready-made workouts to try"
          onPress={() => router.push('/explore')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="gym" label="My routines" hint="Your own saved workouts"
          onPress={() => router.push('/routines')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="plan" label="My plan" hint="What your trainer has scheduled"
          onPress={() => router.push('/plan')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="messages" label="Messages" hint="Talk to your trainer"
          onPress={() => router.push('/messages')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="community" label="Friends" hint="Their workouts, and how your lifts compare"
          onPress={() => router.push('/friends')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="community" label="Community" hint="Leaderboard, challenges and badges"
          onPress={() => router.push('/community')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="coach" label="Coach" hint="Ask about training, form or recovery"
          onPress={() => router.push('/coach')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="nutrition" label="Nutrition" hint="Meals, macros and water"
          onPress={() => router.push('/nutrition')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="classes" label="Classes" hint="Book and cancel" onPress={() => router.push('/classes')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="exercises" label="Exercise library" hint="Form cues and your records"
          onPress={() => router.push('/exercises')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="body" label="Body" hint="Weight and trend" onPress={() => router.push('/body')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="progress" label="Training" hint="Fitness, fatigue and projections"
          onPress={() => router.push('/training')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="location" label="Heatmap" hint="Everywhere you have been"
          onPress={() => router.push('/heatmap')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="goals" label="Goals" hint="Set and track your own targets"
          onPress={() => router.push('/settings/goals')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="visits" label="Visits" hint="Every check-in" onPress={() => router.push('/visits')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="tools" label="Calculators" hint="BMI, calories and macros"
          onPress={() => router.push('/tools')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="referral" label="Referral" hint="Apply a friend's code"
          onPress={() => router.push('/referral')} />
        <View style={{ height: 1, backgroundColor: color.line }} />
        <Link icon="location" label="Find a gym" hint="Browse gyms near you"
          onPress={() => router.push('/gyms')} />
      </Card>

      <Pressable onPress={() => router.push('/settings/profile')} accessibilityRole="button"
        accessibilityLabel="Edit profile">
        <Card>
          <Row>
            <Label>Profile</Label>
            <Row style={{ gap: 4 }}><Txt variant="caption" tone="t3">Edit</Txt><Icon name="chevron" size={13} tone="t4" decorative /></Row>
          </Row>
          {line('Phone', me.phone)}
          {line('Height', me.heightCm ? `${me.heightCm} cm` : null)}
          {line('Weight', me.weightKg ? `${me.weightKg} kg` : null)}
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/membership')} accessibilityRole="button"
        accessibilityLabel="Membership">
        <Card>
          <Row>
            <Label>Membership</Label>
            <Row style={{ gap: 4 }}><Txt variant="caption" tone="t3">Plans</Txt><Icon name="chevron" size={13} tone="t4" decorative /></Row>
          </Row>
          {home?.membership ? (
            <>
              {line('Plan', home.membership.planName)}
              {line('Status', home.membership.status)}
            </>
          ) : (
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              No active membership on this account.
            </Txt>
          )}
        </Card>
      </Pressable>

      <Card>
        <Label>Sync</Label>
        <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
          {pending
            ? `${pending} ${pending === 1 ? 'item is' : 'items are'} saved on this phone and waiting to reach your gym.`
            : 'Everything is synced.'}
        </Txt>
      </Card>

      {confirming ? (
        <Confirm
          title="Sign out?"
          body="Anything not yet synced stays on this phone and will send next time you sign in."
          confirmLabel="Sign out"
          onCancel={() => setConfirming(false)}
          onConfirm={() => signOut()}
        />
      ) : (
        <Button title="Sign out" variant="secondary" onPress={() => setConfirming(true)} />
      )}
    </ScrollView>
  );
}
