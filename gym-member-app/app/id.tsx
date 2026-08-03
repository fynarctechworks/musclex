import { useState } from 'react';
import { Image, View } from 'react-native';
import {
  Badge,
  Card,
  ErrorState,
  SegmentedControl,
  Screen,
  SkeletonCard,
  Txt,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useDigitalId } from '../src/api/queries';

/**
 * Digital member ID — the code a member SHOWS at the desk/turnstile.
 *
 * Two modes:
 *  - Card:    long-lived static token. Works offline once loaded; matches the
 *             printed card staff can issue from the admin panel.
 *  - Rolling: ~30s token with replay protection, for turnstiles that reject
 *             reused codes. The query refetches on an interval to keep it live.
 *
 * The QR image is a PNG data URI rendered by the BFF (the app has no QR
 * encoder dependency). If rendering ever fails we still show the member code,
 * which the front desk can type in.
 */
export default function DigitalIdScreen() {
  const [mode, setMode] = useState<'card' | 'rolling'>('card');
  const { data, isLoading, isError, refetch, isRefetching } = useDigitalId();

  const qr = mode === 'card' ? data?.staticQr : data?.dynamicQr;

  return (
    <Screen>
      <ScreenHeader title="Member ID" />

      {isLoading ? (
        <View className="gap-md">
          <SkeletonCard />
        </View>
      ) : isError || !data ? (
        <Card>
          <ErrorState compact onRetry={refetch} retrying={isRefetching} />
        </Card>
      ) : (
        <View className="gap-md">
          <Card>
            <View className="items-center">
              <Txt variant="body-lg" weight="600" className="text-ink">
                {data.fullName}
              </Txt>
              <View className="mt-xs flex-row items-center gap-xs">
                <Txt variant="body-sm" className="text-body">
                  {data.memberCode}
                </Txt>
                <Badge
                  tone={data.status === 'active' ? 'success' : 'warning'}
                  label={data.status}
                />
              </View>

              <View className="mt-lg" style={{ width: 240, height: 240 }}>
                {qr ? (
                  <Image
                    source={{ uri: qr }}
                    style={{ width: 240, height: 240 }}
                    resizeMode="contain"
                    accessibilityLabel="Your check-in QR code"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Txt variant="body-sm" className="text-mute">
                      Couldn&apos;t render the code — show your member code
                      above to the front desk.
                    </Txt>
                  </View>
                )}
              </View>

              <View className="mt-lg w-full">
                <SegmentedControl
                  options={[
                    { label: 'Card', value: 'card' },
                    { label: 'Rolling', value: 'rolling' },
                  ]}
                  value={mode}
                  onChange={(v) => setMode(v as 'card' | 'rolling')}
                />
              </View>

              <Txt variant="caption" className="mt-md text-center text-mute">
                {mode === 'card'
                  ? 'Your permanent code. Works without a connection.'
                  : 'Refreshes every 30 seconds for extra security.'}
              </Txt>
            </View>
          </Card>
        </View>
      )}
    </Screen>
  );
}
