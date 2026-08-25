import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/ui/Sheet';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useRecordPayment } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { useToast } from '@/ui/Toast';
import { formatCurrency, toAmount } from '@/lib/format';
import type { MemberDetail } from '@/api/types';

type Method = 'cash' | 'card' | 'upi';

/**
 * Collect a payment from the member's page.
 *
 * The amount is pre-filled from the current plan's price — the overwhelmingly
 * common case is "they are paying for their plan" — but stays editable for
 * part-payments, which are normal at a gym counter.
 */
export function CollectPayment({
  member, open, onClose,
}: { member: MemberDetail; open: boolean; onClose: () => void }) {
  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';
  const toast = useToast();
  const record = useRecordPayment();

  const membership = member.memberships?.[0];
  const planPrice = membership?.plan?.price;

  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<Method>('cash');

  // Re-prefill each time the sheet opens: the plan may have changed, and a
  // stale amount from a previous member would be dangerous.
  React.useEffect(() => {
    if (open) {
      const p = toAmount(planPrice as never);
      setAmount(Number.isFinite(p) && p > 0 ? String(p) : '');
      setMethod('cash');
    }
  }, [open, planPrice]);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function submit() {
    const branchId = session?.activeBranchId ?? session?.user?.branch_ids?.[0];
    if (!branchId) { toast.show('Pick a branch first', 'error'); return; }
    try {
      const res = await record.mutateAsync({
        memberId: member.id,
        branchId,
        amount: parsed,
        method,
        membershipId: membership?.id,
      });
      onClose();
      toast.show(
        res?.receipt_number
          ? `${formatCurrency(parsed, currency)} recorded · ${res.receipt_number}`
          : `${formatCurrency(parsed, currency)} recorded`,
      );
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not record payment', 'error');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Collect payment" snapPoints={['60%']}>
      <View className="gap-4">
        <Text className="text-sm text-muted-foreground">
          {member.full_name}
          {membership?.plan?.name ? ` · ${membership.plan.name}` : ''}
        </Text>

        <View className="gap-1">
          <Label><Text>Amount</Text></Label>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            testID="collect-amount"
          />
        </View>

        <SegmentedControl
          value={method}
          onChange={setMethod}
          segments={[
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'upi', label: 'UPI' },
          ]}
        />

        <Button onPress={submit} disabled={!valid || record.isPending} testID="collect-submit">
          <Text>
            {record.isPending
              ? 'Recording…'
              : `Record ${valid ? formatCurrency(parsed, currency) : 'payment'}`}
          </Text>
        </Button>
      </View>
    </Sheet>
  );
}
