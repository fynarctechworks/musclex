import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useNearbyGyms } from '../src/api/queries';
import { useDeviceLocation } from '../src/features/locations/use-device-location';
import { emitFunnelOnce } from '../src/analytics/funnel';
import type { NearbyGym } from '../src/api/types';

function GymCard({ gym }: { gym: NearbyGym }) {
  const theme = useThemeColors();
  const router = useRouter();

  // Tap → full gym profile page (which emits viewed_gym_profile + conversion events).
  return (
    <Card elevated onPress={() => router.push(`/gym/${gym.tenantId}`)}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-md">
          <Txt variant="body-lg" weight="600" className="text-ink">
            {gym.gymName}
          </Txt>
          <Txt variant="body-sm" className="mt-xxs text-body">
            {gym.branchName}
            {gym.city ? ` · ${gym.city}` : ''}
          </Txt>
        </View>
        {gym.distanceKm != null ? (
          <View className="items-end">
            <Txt variant="body-md" weight="600" className="text-ink">
              {gym.distanceKm} km
            </Txt>
            <Txt variant="caption" className="text-mute">
              away
            </Txt>
          </View>
        ) : (
          <Icon name="chevron-right" color={theme.mute} size={20} />
        )}
      </View>
    </Card>
  );
}

/**
 * Public gym finder (Phase 5 conversion engine). Lists active gyms across the
 * platform, nearest-first when device location is granted. Emits the conversion
 * funnel events (viewed_nearby_gyms / viewed_gym_profile / inquiry_click) that the
 * SCC funnel reports on. Open to gym-less public users — the primary "join a gym"
 * surface.
 */
export default function GymsScreen() {
  const { coords } = useDeviceLocation();
  const geo = coords ? { lat: coords.latitude, lng: coords.longitude } : null;
  const { data, isLoading, isError, refetch, isRefetching } = useNearbyGyms(geo);

  useEffect(() => {
    emitFunnelOnce('viewed_nearby_gyms');
  }, []);

  return (
    <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
      <ScreenHeader title="Find gyms near you" />
      <Txt variant="body-sm" className="mt-xxs text-body">
        {geo ? 'Sorted by distance' : 'Enable location for nearest-first'}
      </Txt>

      <View className="mt-md gap-md">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !data || data.gyms.length === 0 ? (
          <EmptyState
            icon="pin"
            title="No gyms found"
            message="There are no listed gyms yet. Check back soon."
          />
        ) : (
          data.gyms.map((g) => <GymCard key={g.branchId} gym={g} />)
        )}
      </View>
    </Screen>
  );
}
