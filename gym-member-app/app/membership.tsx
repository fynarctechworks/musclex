import { Alert, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  ListRow,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useMembership, useRenew } from '../src/api/queries';
import { formatDate, formatMoney } from '../src/lib/format';
import type { MembershipStatus } from '../src/api/types';

const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  expiring: 'warning',
  frozen: 'warning',
  expired: 'error',
};

const DAY = 86_400_000;

export default function MembershipScreen() {
  const theme = useThemeColors();
  const { data, isLoading, isError, refetch, isRefetching } = useMembership();
  const renew = useRenew();

  async function onRenew() {
    const planId = data?.plan?.id;
    if (!planId) return;
    try {
      const order = await renew.mutateAsync(planId);
      // NEXT STEP: open Razorpay checkout with `order` (react-native-razorpay).
      // Payment is confirmed by the BFF webhook — never trust the client result
      // (TRD §9 / Checklist §4.1). We refresh membership after the user returns.
      Alert.alert(
        'Razorpay order created',
        `Order ${order.orderId ?? ''} for ${formatMoney(
          (order.amount ?? 0) / 100,
          order.currency,
        )}.\n\nCheckout SDK integration is the next step; the server confirms payment via webhook.`,
        [{ text: 'OK', onPress: () => refetch() }],
      );
    } catch {
      Alert.alert('Could not start renewal', 'Please try again.');
    }
  }

  const status = data?.status;

  // Real start→expiry timeline (computed from the dates the BFF returns).
  const started = data?.startedOn ? new Date(data.startedOn).getTime() : null;
  const expires = data?.expiresOn ? new Date(data.expiresOn).getTime() : null;
  const now = Date.now();
  const elapsed =
    started != null && expires != null && expires > started
      ? Math.max(0, Math.min(1, (now - started) / (expires - started)))
      : null;
  const daysLeft = expires != null ? Math.ceil((expires - now) / DAY) : null;
  const barColor =
    status === 'expired' ? theme.error : status === 'expiring' ? theme.warning : theme.cyan;

  return (
    <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
      <View className="pt-md">
        <ScreenHeader title="Membership" />

        {isLoading ? (
          <View className="mt-lg gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError && !data ? (
          <Card className="mt-lg">
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : (
          <>
            <Card elevated className="mt-md">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-md">
                  <Txt variant="display-md" weight="600" className="text-ink">
                    {data?.plan?.name ?? 'Membership'}
                  </Txt>
                  {data?.plan?.price != null ? (
                    <Txt variant="body-sm" className="text-body">
                      {formatMoney(data.plan.price, data.plan.currency)} / cycle
                    </Txt>
                  ) : null}
                </View>
                {status ? (
                  <Badge label={status.toUpperCase()} tone={STATUS_TONE[status]} />
                ) : null}
              </View>

              {/* Timeline bar */}
              {elapsed != null ? (
                <View className="mt-lg">
                  <View className="flex-row items-center justify-between">
                    <Txt variant="caption" className="text-mute">
                      {daysLeft != null && daysLeft > 0
                        ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                        : 'Expired'}
                    </Txt>
                    <Txt variant="caption" className="text-mute">
                      {`${Math.round(elapsed * 100)}% elapsed`}
                    </Txt>
                  </View>
                  <View className="mt-xs h-[6px] overflow-hidden rounded-full bg-surface-2">
                    <View
                      style={{ width: `${elapsed * 100}%`, height: '100%', backgroundColor: barColor }}
                    />
                  </View>
                </View>
              ) : null}

              <View className="mt-lg">
                <Button
                  title={status === 'expired' ? 'Renew membership' : 'Renew early'}
                  variant={status === 'expired' || status === 'expiring' ? 'primary' : 'secondary'}
                  fullWidth
                  loading={renew.isPending}
                  onPress={onRenew}
                />
              </View>
            </Card>

            {/* Details */}
            <Txt variant="caption" className="mb-sm mt-lg text-mute">
              DETAILS
            </Txt>
            <Card noPadding>
              <ListRow label="Started" value={formatDate(data?.startedOn)} />
              <ListRow label="Expires" value={formatDate(data?.expiresOn)} />
              <ListRow
                label="Auto-renew"
                value={data?.autoRenew == null ? '—' : data.autoRenew ? 'On' : 'Off'}
                last
              />
            </Card>

            <Txt variant="caption" className="mb-sm mt-lg text-mute">
              INVOICES
            </Txt>
            {(data?.invoices ?? []).length === 0 ? (
              <Card soft>
                <Txt variant="body-sm" className="text-mute">
                  No invoices yet.
                </Txt>
              </Card>
            ) : (
              <View className="gap-sm">
                {(data?.invoices ?? []).map((inv) => (
                  <Card key={inv.id} soft>
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Txt variant="body-md" weight="500" className="text-ink">
                          {formatMoney(inv.amount, inv.currency)}
                        </Txt>
                        <Txt variant="caption" className="text-mute">
                          {inv.paidOn ? formatDate(inv.paidOn) : 'Unpaid'}
                        </Txt>
                      </View>
                      <Badge
                        label={(inv.status ?? 'pending').toUpperCase()}
                        tone={
                          inv.status === 'paid'
                            ? 'success'
                            : inv.status === 'failed'
                              ? 'error'
                              : 'warning'
                        }
                      />
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
