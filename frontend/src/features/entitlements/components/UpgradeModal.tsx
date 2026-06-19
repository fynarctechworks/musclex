'use client';

import React from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEntitlements } from '../entitlement-provider';
import { getFeatureMeta, PLAN_DISPLAY_NAME } from '../registry';
import { UpgradeButton } from './UpgradeButton';
import { trackUpsell } from '../analytics';

/**
 * Shared upgrade experience (audit Deliverable 11). Single instance mounted near the root
 * of the authenticated tree; opened via `useEntitlements().openUpgrade(feature)`.
 *
 * Content contract: Feature name · Why · Current plan · Required plan · Benefits ·
 * Upgrade CTA · Contact Sales CTA · (optional) Start Trial CTA.
 */
export function UpgradeModal() {
  const { upgradeModal, closeUpgrade, plan } = useEntitlements();
  const { open, feature, source } = upgradeModal;
  const meta = feature ? getFeatureMeta(feature) : undefined;

  if (!meta || !feature) return null;

  const currentPlanLabel = PLAN_DISPLAY_NAME[plan.plan] ?? plan.rawPlan;
  const requiredPlanLabel = PLAN_DISPLAY_NAME[meta.requiredPlan];

  const handleContactSales = () => {
    trackUpsell('feature_requested', {
      feature,
      current_plan: plan.rawPlan,
      required_plan: meta.requiredPlan,
      source,
    });
    window.location.href = `mailto:sales@musclex.app?subject=${encodeURIComponent(
      `Upgrade interest: ${meta.name}`,
    )}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeUpgrade()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-link-soft px-2 py-0.5 text-[11px] font-medium text-link-deep">
              <Lock className="h-3 w-3" aria-hidden />
              Available in {requiredPlanLabel}
            </span>
          </div>
          <DialogTitle>{meta.name}</DialogTitle>
          <DialogDescription>{meta.why}</DialogDescription>
        </DialogHeader>

        {/* Plan delta */}
        <div className="flex items-center justify-between rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Current plan: <span className="font-medium text-foreground">{currentPlanLabel}</span>
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="text-muted-foreground">
            Unlocks in: <span className="font-medium text-foreground">{requiredPlanLabel}</span>
          </span>
        </div>

        {/* Benefits */}
        {meta.benefits.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              What you&apos;ll unlock
            </p>
            <ul className="grid gap-1.5">
              {meta.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTAs */}
        <div className="mt-1 flex flex-col gap-2">
          <UpgradeButton
            feature={feature}
            source={source ?? 'upgrade_modal'}
            direct
            label={`Upgrade to ${requiredPlanLabel}`}
            size="md"
            className="w-full"
          />
          <Button variant="outline" size="md" className="w-full" onClick={handleContactSales}>
            Contact Sales
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
