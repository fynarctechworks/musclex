import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import {
  Badge,
  BottomSheet,
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
import { useMembership, useRenew, useAvailablePlans } from '../src/api/queries';
import { config } from '../src/config';
import { notify } from '../src/lib/confirm';
import { formatDate, formatMoney } from '../src/lib/format';
import type { MembershipStatus } from '../src/api/types';

const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  expiring: 'warning',
  frozen: 'warning',
  expired: 'error',
};

const DAY = 86_400_000;

/** Poll /membership every 5 s while waiting for the hosted-checkout payment. */
const PAYMENT_POLL_MS = 5_000;
/** Give up waiting after 5 min — the member can still "Check payment status". */
const PAYMENT_WAIT_TIMEOUT_MS = 5 * 60_000;

/**
 * Plan picker — lists every plan the member's gym offers for their branch and
 * starts checkout for the chosen one. Their current plan is marked and not
 * selectable (use "Renew" for that).
 */
function PlanPickerSheet({
  visible,
  onClose,
  onSelect,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (planId: string) => void;
  busy: boolean;
}) {
  // Only fetch once the sheet is actually opened.
  const { data, isLoading, isError, refetch, isRefetching } = useAvailablePlans(visible);
  const plans = data?.plans ?? [];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Choose a plan">
      {isLoading ? (
        <SkeletonCard />
      ) : isError ? (
        <ErrorState compact onRetry={refetch} retrying={isRefetching} />
      ) : plans.length === 0 ? (
        <Txt variant="body-sm" className="text-body">
          No other plans are available right now. Talk to the front desk for
          options.
        </Txt>
      ) : (
        <View className="gap-sm">
          {plans.map((p) => (
            <Card key={p.id} soft>
              <View className="flex-row items-center justify-between gap-md">
                <View className="flex-1">
                  <View className="flex-row items-center gap-xs">
                    <Txt variant="body-md" weight="600" className="text-ink">
                      {p.name}
                    </Txt>
                    {p.isCurrent && <Badge tone="accent" label="Current" />}
                  </View>
                  <Txt variant="caption" className="mt-xxs text-mute">
                    {[
                      formatMoney(p.price),
                      p.durationDays ? `${p.durationDays} days` : null,
                      p.totalClasses ? `${p.totalClasses} classes` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Txt>
                </View>
                <Button
                  title={p.isCurrent ? 'Current' : 'Choose'}
                  size="sm"
                  variant={p.isCurrent ? 'ghost' : 'primary'}
                  disabled={p.isCurrent || busy}
                  onPress={() => onSelect(p.id)}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

export default function MembershipScreen() {
  const theme = useThemeColors();
  // "Waiting for payment" — set after the hosted checkout opens in the browser;
  // while true the membership query polls so the webhook-confirmed renewal
  // shows up here automatically (we never trust a client payment result).
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Snapshot of status/expiry when the checkout opened — a change means the
  // server confirmed the payment and extended the membership.
  const baselineRef = useRef<{
    status: MembershipStatus | undefined;
    expiresOn: string | null | undefined;
  } | null>(null);
  const { data, isLoading, isError, refetch, isRefetching } = useMembership(
    awaitingPayment ? PAYMENT_POLL_MS : false,
  );
  const renew = useRenew();

  /**
   * Start checkout for a specific plan. Passing the CURRENT plan is a renewal;
   * passing a different one is an upgrade/downgrade — the BFF has always
   * accepted any plan in the member's gym, the app just never offered a choice.
   */
  async function startCheckout(planId: string) {
    if (!planId) return;
    setPickerOpen(false);
    try {
      const order = await renew.mutateAsync(planId);
      if (!order?.orderId) {
        notify('Could not start renewal', 'Please try again.');
        return;
      }
      // Hand off to the hosted Razorpay checkout in the device browser.
      // Payment is confirmed by the BFF webhook — never trust the client result
      // (TRD §9 / Checklist §4.1). We poll /membership until it reflects it.
      baselineRef.current = {
        status: data?.status,
        expiresOn: data?.expiresOn ?? null,
      };
      await Linking.openURL(`${config.payBaseUrl}/pay/${order.orderId}`);
      setAwaitingPayment(true);
    } catch {
      notify('Could not start renewal', 'Please try again.');
    }
  }

  /** Renew on the current plan — the one-tap path. */
  function onRenew() {
    const planId = data?.plan?.id;
    if (!planId) {
      setPickerOpen(true);
      return;
    }
    void startCheckout(planId);
  }

  // While waiting: detect the server-confirmed renewal (status/expiry changed).
  useEffect(() => {
    if (!awaitingPayment || !data) return;
    const base = baselineRef.current;
    if (!base) return;
    const confirmed =
      (data.expiresOn ?? null) !== (base.expiresOn ?? null) ||
      (data.status !== base.status && data.status === 'active');
    if (confirmed) {
      setAwaitingPayment(false);
      baselineRef.current = null;
      notify('Payment confirmed', 'Your membership has been updated.');
    }
  }, [awaitingPayment, data]);

  // Safety timeout: stop polling after 5 minutes (webhook may lag; the member
  // can keep checking manually or pull to refresh).
  useEffect(() => {
    if (!awaitingPayment) return;
    const timer = setTimeout(() => {
      setAwaitingPayment(false);
      baselineRef.current = null;
      notify(
        'Still waiting for payment',
        'We could not confirm the payment yet. If you paid, pull to refresh in a moment — it can take a minute to reflect.',
      );
    }, PAYMENT_WAIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [awaitingPayment]);

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
            {awaitingPayment ? (
              <Card soft className="mt-md">
                <Txt variant="body-md" weight="600" className="text-ink">
                  Waiting for payment
                </Txt>
                <Txt variant="body-sm" className="mt-xs text-body">
                  Complete the payment in your browser — this screen will update
                  automatically.
                </Txt>
                <View className="mt-md">
                  <Button
                    title="Check payment status"
                    variant="secondary"
                    fullWidth
                    loading={isRefetching}
                    onPress={() => refetch()}
                  />
                </View>
              </Card>
            ) : null}

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

              <View className="mt-lg gap-sm">
                <Button
                  title={status === 'expired' ? 'Renew membership' : 'Renew early'}
                  variant={status === 'expired' || status === 'expiring' ? 'primary' : 'secondary'}
                  fullWidth
                  loading={renew.isPending}
                  disabled={awaitingPayment}
                  onPress={onRenew}
                />
                <Button
                  title="Change plan"
                  variant="ghost"
                  fullWidth
                  disabled={awaitingPayment || renew.isPending}
                  onPress={() => setPickerOpen(true)}
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

            <PlanPickerSheet
              visible={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={startCheckout}
              busy={renew.isPending}
            />

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
