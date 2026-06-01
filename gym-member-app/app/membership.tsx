import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Screen,
  SkeletonCard,
  Txt,
} from '../src/design-system';
import { useMembership, useRenew } from '../src/api/queries';
import { formatDate, formatMoney } from '../src/lib/format';
import type { MembershipStatus } from '../src/api/types';

const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  expiring: 'warning',
  frozen: 'warning',
  expired: 'error',
};

export default function MembershipScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useMembership();
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

  return (
    <Screen scroll onRefresh={refetch} refreshing={isRefetching}>
      <View className="pt-md">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mb-lg">
          <Txt variant="body-sm" className="text-body">{'←  Back'}</Txt>
        </Pressable>

        <Txt variant="display-lg" weight="600" className="text-ink">
          Membership
        </Txt>

        {isLoading ? (
          <View className="mt-lg gap-md">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <Card elevated className="mt-md">
              <View className="flex-row items-center justify-between">
                <View>
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

              <View className="mt-md h-[1px] bg-hairline" />

              <View className="mt-md flex-row justify-between">
                <View>
                  <Txt variant="caption" className="text-mute">STARTED</Txt>
                  <Txt variant="body-md" className="text-ink">{formatDate(data?.startedOn)}</Txt>
                </View>
                <View className="items-end">
                  <Txt variant="caption" className="text-mute">EXPIRES</Txt>
                  <Txt variant="body-md" className="text-ink">{formatDate(data?.expiresOn)}</Txt>
                </View>
              </View>

              {status === 'expiring' || status === 'expired' ? (
                <View className="mt-lg">
                  <Button
                    title={status === 'expired' ? 'Renew membership' : 'Renew early'}
                    fullWidth
                    loading={renew.isPending}
                    onPress={onRenew}
                  />
                </View>
              ) : (
                <View className="mt-lg">
                  <Button
                    title="Manage / upgrade plan"
                    variant="secondary"
                    fullWidth
                    loading={renew.isPending}
                    onPress={onRenew}
                  />
                </View>
              )}
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
