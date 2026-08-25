import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/ui/DataList';
import { RowCard } from '@/ui/RowCard';
import { Sheet } from '@/ui/Sheet';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { EmptyState } from '@/ui/States';
import { Can } from '@/rbac/Gate';
import {
  useCreateSale, useCurrentStaff, useProducts, type PosCartLine,
} from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { useToast } from '@/ui/Toast';
import { formatCurrency, toAmount } from '@/lib/format';
import type { Product } from '@/api/types';
import { tokens } from '@/ui/tokens';

type PayMethod = 'cash' | 'card' | 'upi';

/**
 * Point of sale.
 *
 * Gated on `inventory.create` — selling is not the same as viewing stock, and
 * an accountant with view/export must not get a till (the tab is hidden for
 * them for the same reason).
 */
export default function Pos() {
  const [search, setSearch] = React.useState('');
  const [cart, setCart] = React.useState<PosCartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [method, setMethod] = React.useState<PayMethod>('cash');

  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';
  const toast = useToast();

  const products = useProducts();
  const staff = useCurrentStaff(session?.user?.id);
  const sale = useCreateSale();

  const items = (products.data?.data ?? []).filter((p) =>
    p.product_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  // price is a Decimal string — multiplying without coercion yields NaN.
  const total = cart.reduce((sum, l) => sum + toAmount(l.product.price) * l.quantity, 0);
  const count = cart.reduce((sum, l) => sum + l.quantity, 0);

  function add(product: Product) {
    setCart((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function bump(productId: string, by: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + by } : l))
        // Dropping to zero removes the line — a zero-quantity line would be
        // rejected by the API (@Min(1)) and is meaningless on a receipt.
        .filter((l) => l.quantity > 0),
    );
  }

  async function checkout() {
    const branchId = session?.activeBranchId ?? session?.user?.branch_ids?.[0];
    const staffId = staff.data?.id;

    // Both are required by the API. Say which one is missing rather than
    // failing with a validation error the staffer cannot act on.
    if (!branchId) { toast.show('Pick a branch before selling', 'error'); return; }
    if (!staffId) { toast.show('Your staff record could not be found', 'error'); return; }

    try {
      const res = await sale.mutateAsync({ branchId, staffId, lines: cart, paymentMethod: method });
      setCheckoutOpen(false);
      setCart([]);
      setSearch('');
      toast.show(res?.invoice_number ? `Sale ${res.invoice_number} recorded` : 'Sale recorded');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Sale failed', 'error');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <Can
        module="inventory"
        action="create"
        fallback={<EmptyState title="Not available" body="Your role does not include selling." />}>
        <View className="gap-3 px-4 pb-3 pt-2">
          <Text className="text-2xl font-semibold text-foreground">Shop</Text>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search products"
            autoCapitalize="none"
            testID="pos-search"
          />
        </View>

        <DataList<Product>
          data={items}
          isLoading={products.isLoading}
          error={products.error}
          onRetry={() => void products.refetch()}
          keyExtractor={(p) => p.id}
          emptyTitle="No products"
          emptyBody="Add products on the web to sell them here."
          renderItem={({ item }) => (
            <RowCard
              title={item.product_name}
              subtitle={formatCurrency(item.price, currency)}
              trailing={
                <Button size="sm" variant="outline" onPress={() => add(item)}>
                  <Plus size={16} color={tokens.foreground} />
                  <Text>Add</Text>
                </Button>
              }
              chevron={false}
              testID={`product-${item.id}`}
            />
          )}
        />

        {/* Cart bar — always visible once something is in it, so the staffer
            never loses track of an in-progress sale while browsing. */}
        {count > 0 ? (
          <View className="border-t border-border bg-card px-4 py-3">
            <Button onPress={() => setCheckoutOpen(true)} testID="pos-checkout">
              <Text>
                {count} {count === 1 ? 'item' : 'items'} · {formatCurrency(total, currency)} · Checkout
              </Text>
            </Button>
          </View>
        ) : null}

        <Sheet open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Checkout" snapPoints={['70%']}>
          <View className="gap-3">
            {cart.map((l) => (
              <View key={l.product.id} className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-base text-foreground">{l.product.product_name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {formatCurrency(l.product.price, currency)} each
                  </Text>
                </View>
                <Button size="sm" variant="outline" onPress={() => bump(l.product.id, -1)}>
                  <Minus size={14} color={tokens.foreground} />
                </Button>
                <Text className="w-6 text-center text-foreground">{l.quantity}</Text>
                <Button size="sm" variant="outline" onPress={() => bump(l.product.id, 1)}>
                  <Plus size={14} color={tokens.foreground} />
                </Button>
              </View>
            ))}

            <View className="flex-row items-center justify-between border-t border-border pt-3">
              <Text className="text-base font-medium text-foreground">Total</Text>
              <Text className="text-lg font-semibold text-foreground">
                {formatCurrency(total, currency)}
              </Text>
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

            <Button onPress={checkout} testID="pos-confirm">
              <Text>{sale.isPending ? 'Recording…' : `Take ${formatCurrency(total, currency)}`}</Text>
            </Button>
            <Badge variant="secondary"><Text>Stock is not shown — tracked separately</Text></Badge>
          </View>
        </Sheet>
      </Can>
    </SafeAreaView>
  );
}
