import { useMemo } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import {
  Badge,
  Button,
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
import { useLocations } from '../src/api/queries';
import { useDeviceLocation } from '../src/features/locations/use-device-location';
import { formatDistance, haversineKm } from '../src/lib/geo';
import type { GymLocation, LocationStatus } from '../src/api/types';

const STATUS_TONE: Record<LocationStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  coming_soon: 'warning',
  temporarily_closed: 'warning',
  provisioning: 'neutral',
  inactive: 'error',
};

function statusLabel(s?: LocationStatus) {
  if (!s) return '';
  return s.replace(/_/g, ' ').toUpperCase();
}

/** Deep-link into the device's maps app for turn-by-turn / pin view. */
function openInMaps(b: GymLocation) {
  if (b.latitude == null || b.longitude == null) return;
  const label = encodeURIComponent(b.name ?? 'Gym');
  const ll = `${b.latitude},${b.longitude}`;
  const url =
    Platform.select({
      ios: `http://maps.apple.com/?ll=${ll}&q=${label}`,
      android: `geo:${ll}?q=${ll}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    }) ?? `https://www.google.com/maps/search/?api=1&query=${ll}`;
  void Linking.openURL(url);
}

function LocationCard({ branch, distanceKm }: { branch: GymLocation; distanceKm: number | null }) {
  const theme = useThemeColors();
  const hasCoords = branch.latitude != null && branch.longitude != null;
  return (
    <Card elevated>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-md">
          <Txt variant="body-lg" weight="600" className="text-ink">
            {branch.name ?? 'Branch'}
          </Txt>
          {branch.address ? (
            <View className="mt-xs flex-row items-start gap-xs">
              <View className="mt-[2px]">
                <Icon name="pin" color={theme.mute} size={15} />
              </View>
              <Txt variant="body-sm" className="flex-1 text-body">
                {branch.address}
              </Txt>
            </View>
          ) : (
            <Txt variant="body-sm" className="mt-xs text-mute">
              Location not set yet
            </Txt>
          )}
          {branch.city ? (
            <Txt variant="caption" className="mt-xxs text-mute">
              {branch.city}
            </Txt>
          ) : null}
        </View>
        <View className="items-end gap-xs">
          {branch.status ? (
            <Badge label={statusLabel(branch.status)} tone={STATUS_TONE[branch.status]} />
          ) : null}
          {distanceKm != null ? (
            <Txt variant="caption" weight="600" className="text-body">
              {formatDistance(distanceKm)}
            </Txt>
          ) : null}
        </View>
      </View>

      <View className="mt-md flex-row gap-sm">
        <View className="flex-1">
          <Button
            title="Directions"
            variant="secondary"
            fullWidth
            disabled={!hasCoords}
            onPress={() => openInMaps(branch)}
          />
        </View>
        {branch.phone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${branch.name ?? 'branch'}`}
            onPress={() => Linking.openURL(`tel:${branch.phone}`)}
            className="h-[44px] w-[44px] items-center justify-center rounded-md border border-hairline bg-surface-2"
          >
            <Icon name="phone" color={theme.ink} size={18} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

/** Status-aware strip above the list explaining (or fixing) location access. */
function LocationBanner({
  status,
  onRetry,
}: {
  status: ReturnType<typeof useDeviceLocation>['status'];
  onRetry: () => void;
}) {
  const theme = useThemeColors();
  if (status === 'granted') {
    return (
      <Txt variant="caption" className="mb-sm text-mute">
        Sorted by distance from you.
      </Txt>
    );
  }
  if (status === 'prompting') {
    return (
      <Txt variant="caption" className="mb-sm text-mute">
        Finding your location…
      </Txt>
    );
  }
  // denied | unavailable
  const message =
    status === 'denied'
      ? 'Location access is off, so branches aren’t sorted by distance. Enable it to find the nearest gym.'
      : 'We couldn’t get your location. Check that location services are on, then try again.';
  return (
    <Card soft className="mb-md">
      <View className="flex-row items-center gap-sm">
        <Icon name="pin" color={theme.mute} size={18} />
        <Txt variant="body-sm" className="flex-1 text-body">
          {message}
        </Txt>
      </View>
      <View className="mt-sm">
        <Button title="Use my location" variant="secondary" onPress={onRetry} />
      </View>
    </Card>
  );
}

export default function LocationsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useLocations();
  const { coords, status, request } = useDeviceLocation();

  // Annotate with distance (when we have device coords + branch coords), then
  // sort nearest-first; branches without coordinates sink to the bottom by name.
  const ranked = useMemo(() => {
    const list = (data?.branches ?? []).map((b) => ({
      branch: b,
      km:
        coords && b.latitude != null && b.longitude != null
          ? haversineKm(coords, { latitude: b.latitude, longitude: b.longitude })
          : null,
    }));
    list.sort((x, y) => {
      if (x.km == null && y.km == null) {
        return (x.branch.name ?? '').localeCompare(y.branch.name ?? '');
      }
      if (x.km == null) return 1;
      if (y.km == null) return -1;
      return x.km - y.km;
    });
    return list;
  }, [data?.branches, coords]);

  return (
    <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
      <View className="pt-md">
        <ScreenHeader title="Locations" />
        <Txt variant="body-sm" className="mb-lg mt-xxs text-body">
          Find a branch near you and get directions.
        </Txt>

        {isLoading ? (
          <View className="gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError && !data ? (
          <Card>
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : ranked.length === 0 ? (
          <EmptyState
            icon="pin"
            title="No locations yet"
            message="Your gym hasn't added any branch locations."
          />
        ) : (
          <>
            <LocationBanner status={status} onRetry={request} />
            <View className="gap-md">
              {ranked.map(({ branch, km }) => (
                <LocationCard key={branch.id} branch={branch} distanceKm={km} />
              ))}
            </View>
          </>
        )}

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
