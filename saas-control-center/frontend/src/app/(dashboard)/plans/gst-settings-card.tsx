'use client';

import { useEffect, useState } from 'react';
import { useGstSettings, useUpdateGstSettings } from '@/hooks/use-plans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Receipt, Loader2, Check } from 'lucide-react';

/**
 * Platform-wide subscription GST control. The rate set here is applied
 * (exclusive, on top) to every paid plan during gym onboarding/renewal and
 * shown in the payment summary + tax invoice.
 */
export function GstSettingsCard() {
  const { data, isLoading } = useGstSettings();
  const update = useUpdateGstSettings();

  const [enabled, setEnabled] = useState(true);
  const [percent, setPercent] = useState('18');
  const [label, setLabel] = useState('GST');
  const [saved, setSaved] = useState(false);

  // Hydrate the form once the setting loads.
  useEffect(() => {
    if (data) {
      setEnabled(data.gst_enabled);
      setPercent(String(data.gst_percent));
      setLabel(data.gst_label);
    }
  }, [data]);

  const dirty =
    !!data &&
    (enabled !== data.gst_enabled ||
      Number(percent) !== data.gst_percent ||
      label !== data.gst_label);

  const pctNum = Number(percent);
  const valid = Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 100;

  const handleSave = () => {
    if (!valid) return;
    setSaved(false);
    update.mutate(
      { gst_enabled: enabled, gst_percent: +pctNum.toFixed(2), gst_label: label.trim() || 'GST' },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      },
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <Receipt className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Subscription GST</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 max-w-md">
              Applied on top of every paid plan at checkout. Shows on the onboarding payment
              summary and the tax invoice. Changes sync to onboarding within 60 seconds.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isLoading} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground">Rate (%)</label>
          <div className="relative w-28">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              disabled={isLoading || !enabled}
              className="pr-7"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
              %
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground">Label</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={isLoading || !enabled}
            maxLength={16}
            className="w-36"
            placeholder="GST"
          />
        </div>

        <Button
          size="sm"
          className="text-[13px]"
          onClick={handleSave}
          disabled={!dirty || !valid || update.isPending || isLoading}
        >
          {update.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Saved
            </>
          ) : (
            'Save'
          )}
        </Button>
      </div>

      {!valid && (
        <p className="mt-2 text-[11px] text-destructive">Rate must be between 0 and 100.</p>
      )}
    </div>
  );
}
