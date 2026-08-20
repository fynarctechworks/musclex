import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../../src/ui';
import { color, space } from '../../src/ui/theme';
import { whenOf } from '../../src/lib/datetime';
import { useCheckIn, useDigitalId, useHome, useLocations, useOccupancy } from '../../src/api/queries';
import { OccupancyCard } from './index';

/**
 * GYM — everything tied to the physical place: how busy it is, getting in, and
 * what is on. This is the half Hevy and Strava structurally cannot do, because
 * neither of them knows which gym you belong to.
 */
/** Tab bar height plus the raised action button that sits above it. The
 *  device's own home-indicator inset is added on top at render. */
const TAB_BAR_CLEARANCE = 108;

export default function GymScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: home, refetch, isRefetching } = useHome();
  const { data: occ } = useOccupancy();
  const { data: id, isLoading } = useDigitalId();
  const checkIn = useCheckIn();
  const { data: locations } = useLocations();

  if (isLoading && !id) return <Loading label="Loading your gym" />;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.lg,
        paddingTop: insets.top + space.md,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space.md,
      }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={color.t3} />
      }
    >
      <Txt variant="title">Your gym</Txt>

      {occ ?? home?.occupancy ? <OccupancyCard occ={(occ ?? home!.occupancy)!} /> : null}

      <Card>
        <Label>Check in</Label>
        <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
          Show this at the front desk. The code rotates every 35 seconds, so a screenshot will
          not work.
        </Txt>

        {id?.dynamicQr ? (
          <View style={{
              backgroundColor: color.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: color.line,
              padding: 14,
              marginTop: space.lg,
              alignItems: 'center',
            }}>
            <Image
              source={{ uri: id.dynamicQr }}
              style={{ width: 176, height: 176 }}
              accessibilityLabel="Your check-in QR code"
            />
          </View>
        ) : (
          <Empty title="QR unavailable" body="Your gym has not issued a code for this account." />
        )}

        <Row style={{ marginTop: space.md }}>
          <View>
            <Txt variant="caption" tone="t3">Member code</Txt>
            <Txt variant="bodyStrong" style={{ marginTop: 2 }}>{id?.memberCode ?? '--'}</Txt>
          </View>
        </Row>

        <View style={{ marginTop: space.lg }}>
          <Button
            title="Check in now"
            loading={checkIn.isPending}
            onPress={() => checkIn.mutate()}
          />
        </View>
      </Card>

      <Card>
        <Label>Locations</Label>
        {(locations?.branches ?? []).length === 0 ? (
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            No branches listed.
          </Txt>
        ) : (
          (locations?.branches ?? []).map((br) => (
            <View key={br.id} style={{ marginTop: space.md }}>
              <Txt variant="bodyStrong">{br.name}</Txt>
              <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                {[br.address, br.city].filter(Boolean).join(', ')}
              </Txt>
            </View>
          ))
        )}
      </Card>

      <Pressable onPress={() => router.push('/challenges')} accessibilityRole="button"
        accessibilityLabel="Group challenges">
        <Card>
          <Row>
            <Label>Challenges</Label>
            <Txt variant="caption" tone="t3">Race ›</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Set your own against friends — distance, time, climbing or workouts.
          </Txt>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/people')} accessibilityRole="button"
        accessibilityLabel="Find people">
        <Card>
          <Row>
            <Label>Find people</Label>
            <Txt variant="caption" tone="t3">Search ›</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Suggestions, your own code, and contacts — checked without uploading them.
          </Txt>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/dm')} accessibilityRole="button"
        accessibilityLabel="Direct messages">
        <Card>
          <Row>
            <Label>Messages</Label>
            <Txt variant="caption" tone="t3">Open ›</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Talk to the people you train with. Trainers have their own threads.
          </Txt>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/clubs')} accessibilityRole="button"
        accessibilityLabel="Clubs">
        <Card>
          <Row>
            <Label>Clubs</Label>
            <Txt variant="caption" tone="t3">Browse ›</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Groups that train together, with their own feed and events.
          </Txt>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/feed')} accessibilityRole="button"
        accessibilityLabel="Activity feed">
        <Card>
          <Row>
            <Label>Feed</Label>
            <Txt variant="caption" tone="t3">Open ›</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            What the people you follow have been doing.
          </Txt>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/activities')} accessibilityRole="button"
        accessibilityLabel="Your activities">
        <Card>
          <Row>
            <Label>Activities</Label>
            <Txt variant="caption" tone="t3">Record ›</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Runs, rides, swims and everything else — tracked live or added by hand.
          </Txt>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/exercises')} accessibilityRole="button"
        accessibilityLabel="Exercise library">
        <Card>
          <Row>
            <Label>Exercise library</Label>
            <Txt variant="caption" tone="t3">Browse ›</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Every lift your gym supports, with your own records on each.
          </Txt>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/classes')} accessibilityRole="button"
        accessibilityLabel="See all classes">
      <Card>
        <Row>
          <Label>Next class</Label>
          <Txt variant="caption" tone="t3">All classes ›</Txt>
        </Row>
        {home?.nextClass ? (
          <>
            <Txt variant="heading" style={{ marginTop: space.sm }}>{home.nextClass.title}</Txt>
            <Txt variant="small" tone="t2" style={{ marginTop: 2 }}>
              {whenOf(home.nextClass.startsAt)} · {home.nextClass.seatsLeft} seats left
            </Txt>
          </>
        ) : (
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Nothing scheduled at your branch.
          </Txt>
        )}
      </Card>
      </Pressable>
    </ScrollView>
  );
}
