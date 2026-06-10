import { useEffect } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';
import { useGymProfile } from '../../src/api/queries';
import { emitFunnel } from '../../src/analytics/funnel';
import type { NearbyGym } from '../../src/api/types';

function openMaps(b: NearbyGym, tenantId: string) {
  if (b.latitude == null || b.longitude == null) return;
  emitFunnel('inquiry_click', { tenantId, channel: 'directions' });
  const ll = `${b.latitude},${b.longitude}`;
  const label = encodeURIComponent(b.gymName);
  const url =
    Platform.select({
      ios: `http://maps.apple.com/?ll=${ll}&q=${label}`,
      android: `geo:${ll}?q=${ll}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    }) ?? `https://www.google.com/maps/search/?api=1&query=${ll}`;
  void Linking.openURL(url);
}

/**
 * Public gym profile page (Phase 7.5) — the conversion surface for a single gym:
 * identity, membership plans, branches, contact + directions. Emits the lead
 * funnel events (viewed_gym_profile on open, inquiry_click on call/directions).
 */
export default function GymProfileScreen() {
  const theme = useThemeColors();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const id = String(tenantId ?? '');
  const { data, isLoading, isError, refetch, isRefetching } = useGymProfile(id);

  useEffect(() => {
    if (id) emitFunnel('viewed_gym_profile', { tenantId: id });
  }, [id]);

  const call = (phone: string) => {
    emitFunnel('inquiry_click', { tenantId: id, channel: 'call' });
    void Linking.openURL(`tel:${phone}`);
  };

  return (
    <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
      <ScreenHeader />
      {isLoading ? (
        <View className="mt-md gap-md">
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError || !data ? (
        <View className="mt-md">
          <ErrorState title="Could not load gym" onRetry={refetch} />
        </View>
      ) : (
        <View className="mt-sm gap-md">
          {/* Identity */}
          <View>
            <Txt variant="display-md" weight="600" className="text-ink">
              {data.gymName}
            </Txt>
            {data.tagline ? (
              <Txt variant="body-sm" className="mt-xxs text-body">{data.tagline}</Txt>
            ) : null}
            {data.city ? (
              <Txt variant="caption" className="mt-xxs text-mute">{data.city}</Txt>
            ) : null}
          </View>

          {/* Membership plans */}
          {data.plans.length > 0 ? (
            <Card elevated>
              <Txt variant="caption" className="text-mute">MEMBERSHIP PLANS</Txt>
              <View className="mt-sm gap-xs">
                {data.plans.map((p) => (
                  <View key={p.id} className="flex-row items-center justify-between border-b border-hairline py-sm">
                    <View className="flex-1 pr-md">
                      <Txt variant="body-md" weight="600" className="text-ink">{p.name}</Txt>
                      {p.description ? (
                        <Txt variant="caption" className="text-mute">{p.description}</Txt>
                      ) : null}
                    </View>
                    <View className="items-end">
                      {p.price != null ? (
                        <Txt variant="body-md" weight="600" className="text-ink">₹{p.price}</Txt>
                      ) : null}
                      {p.durationDays ? (
                        <Txt variant="caption" className="text-mute">{p.durationDays} days</Txt>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Branches + contact */}
          {data.branches.map((b) => (
            <Card key={b.branchId}>
              <Txt variant="body-lg" weight="600" className="text-ink">{b.branchName}</Txt>
              {b.address ? (
                <Txt variant="body-sm" className="mt-xxs text-body">{b.address}</Txt>
              ) : null}
              <View className="mt-sm flex-row gap-xs">
                {b.phone ? <Button title="Call" size="sm" onPress={() => call(b.phone!)} /> : null}
                {b.latitude != null && b.longitude != null ? (
                  <Button title="Directions" size="sm" variant="secondary" onPress={() => openMaps(b, id)} />
                ) : null}
              </View>
            </Card>
          ))}

          {/* Join CTA */}
          <Card elevated>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-md">
                <Txt variant="body-lg" weight="600" className="text-ink">Interested in joining?</Txt>
                <Txt variant="body-sm" className="text-body">Call the gym to ask about a trial or membership.</Txt>
              </View>
              <Icon name="phone" color={theme.cyan} size={22} />
            </View>
          </Card>
        </View>
      )}
    </Screen>
  );
}
