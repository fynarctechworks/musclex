import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { shortDate } from '../src/lib/datetime';
import { useMembership, useMembershipPlans, useRenewMembership } from '../src/api/queries';

/** The gym's hosted checkout. Payment truth stays server-side, behind a webhook. */
const PAY_BASE = process.env.EXPO_PUBLIC_PAY_BASE_URL ?? 'https://app.musclex.infynarc.com';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * MEMBERSHIP — the current plan and what else the gym offers.
 *
 * Renewal deliberately does NOT take card details in-app. The BFF creates a
 * Razorpay order and the gym's hosted checkout completes it, with payment truth
 * settled server-side by a webhook. Re-implementing a card form here would mean
 * a second place that can be wrong about money, and a PCI surface this app has
 * no reason to own.
 */
export default function MembershipScreen() {
  const insets = useSafeAreaInsets();
  const { data: membership } = useMembership();
  const { data, isLoading } = useMembershipPlans();
  const renew = useRenewMembership();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Loading label="Loading membership" />;

  const plans = data?.plans ?? [];

  /**
   * Create the order, then hand the member to the hosted checkout. If the
   * browser cannot be opened we surface the order id rather than pretending
   * nothing happened — the order exists on the server either way.
   */
  async function startRenewal(planId: string) {
    setError(null);
    try {
      const order = await renew.mutateAsync(planId);
      const url = `${PAY_BASE}/pay/${order.orderId}`;
      const opened = await Linking.openURL(url).then(() => true).catch(() => false);
      if (!opened) setError(`Open ${url} to finish paying.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the renewal.');
    }
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Membership" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        {error ? <Notice title="Renewal" body={error} onDismiss={() => setError(null)} /> : null}

        <Card tone={membership ? 'good' : 'default'}>
          <Label>Current plan</Label>
          {membership ? (
            <>
              <Txt variant="title" className="mt-2">{membership.planName}</Txt>
              <Row className="mt-3">
                <Txt variant="small" tone="t2">Status</Txt>
                <Txt variant="bodyStrong" style={{ textTransform: 'capitalize' }}>
                  {membership.status ?? 'active'}
                </Txt>
              </Row>
              {membership.endDate ? (
                <Row className="mt-2">
                  <Txt variant="small" tone="t2">Runs until</Txt>
                  <Txt variant="bodyStrong">{shortDate(membership.endDate)}</Txt>
                </Row>
              ) : null}
              {membership.daysRemaining != null ? (
                <Row className="mt-2">
                  <Txt variant="small" tone="t2">Days left</Txt>
                  <Txt
                    variant="bodyStrong"
                    tone={membership.daysRemaining <= 7 ? 'accent' : 't1'}
                  >
                    {membership.daysRemaining}
                  </Txt>
                </Row>
              ) : null}
            </>
          ) : (
            <Txt variant="small" tone="t2" className="mt-2">
              You do not have an active membership. Ask at the front desk, or pick a plan below.
            </Txt>
          )}
        </Card>

        <View>
          <Label>Plans at your gym</Label>
        </View>

        {plans.length === 0 ? (
          <Empty title="No plans published" body="Your gym has not listed any plans yet." />
        ) : (
          plans.map((p) => (
            <Card key={p.id} tone={p.isCurrent ? 'accent' : 'default'}>
              <Row className="items-start">
                <View className="flex-1 pr-3">
                  <Txt variant="heading">{p.name}</Txt>
                  {p.description ? (
                    <Txt variant="caption" tone="t3" className="mt-0.5">{p.description}</Txt>
                  ) : null}
                  <Txt variant="caption" tone="t3" className="mt-1">
                    {p.durationDays ? `${p.durationDays} days` : ''}
                    {p.totalClasses ? ` · ${p.totalClasses} classes` : ''}
                    {p.accessType === 'all_branches' ? ' · all branches' : ''}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="heading">{rupees(p.price)}</Txt>
                  {p.isCurrent ? (
                    <Txt variant="caption" tone="accent" className="mt-0.5">Current</Txt>
                  ) : null}
                </View>
              </Row>
              <View className="mt-3">
                <Button
                  title={p.isCurrent ? 'Renew this plan' : 'Choose this plan'}
                  variant={p.isCurrent ? 'primary' : 'secondary'}
                  size="sm"
                  loading={renew.isPending}
                  onPress={() => startRenewal(p.id)}
                />
              </View>
            </Card>
          ))
        )}

        <Txt variant="caption" tone="t3" className="mt-2 text-center">
          Payment opens your gym's secure checkout. Card details are never entered in this app.
        </Txt>
      </ScrollView>
    </View>
  );
}
