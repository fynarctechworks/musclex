'use client';

import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { AccessDenied } from '@/components/shared/access-denied';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLoyaltyConfig, useUpsertLoyaltyConfig } from '@/features/wallet';

export default function LoyaltySettingsPage() {
  const { allowed, checked } = useRequirePermission('settings', 'view', 'deny');
  const { data: config, isLoading } = useLoyaltyConfig();
  const save = useUpsertLoyaltyConfig();

  const [isActive, setIsActive] = useState(false);
  const [pointsPerCurrency, setPointsPerCurrency] = useState('1');
  const [redeemValue, setRedeemValue] = useState('1');
  const [minRedeem, setMinRedeem] = useState('0');

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setPointsPerCurrency(String(config.points_per_currency));
      setRedeemValue(String(config.redeem_value_per_point));
      setMinRedeem(String(config.min_redeem_points));
    }
  }, [config]);

  const submit = () => {
    save.mutate({
      is_active: isActive,
      points_per_currency: Number(pointsPerCurrency),
      redeem_value_per_point: Number(redeemValue),
      min_redeem_points: Number(minRedeem),
    });
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  const earnRate = Number(pointsPerCurrency) || 0;
  const redeemRate = Number(redeemValue) || 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Loyalty Program"
          description="Configure how members earn and redeem loyalty points at POS"
        />

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 pr-4">
                <Label className="text-foreground flex items-center gap-1.5">
                  <Star className="h-4 w-4" />
                  Enable loyalty program
                </Label>
                <p className="text-xs text-muted-foreground">
                  When off, no points are earned or redeemable. Existing balances are preserved.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <Label className="text-foreground">Points earned per ₹1 spent</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={pointsPerCurrency}
                  onChange={(e) => setPointsPerCurrency(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">₹ value per point on redeem</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={redeemValue}
                  onChange={(e) => setRedeemValue(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Minimum points to redeem</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={minRedeem}
                  onChange={(e) => setMinRedeem(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
              Example: a ₹1,000 purchase earns{' '}
              <span className="text-foreground font-medium">{Math.floor(1000 * earnRate)} points</span>.
              {' '}100 points redeem for{' '}
              <span className="text-foreground font-medium">₹{(100 * redeemRate).toFixed(2)}</span>.
            </div>

            <div className="flex justify-end pt-1">
              <Button
                onClick={submit}
                disabled={save.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {save.isPending ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
