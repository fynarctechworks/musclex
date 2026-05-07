'use client';

import { useState, useEffect } from 'react';
import { Gift, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useValidateReferralCode, useApplyReferralCode } from '@/features/gym-referrals';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ApplyCodeDialog({ open, onOpenChange }: Props) {
  const [code, setCode] = useState('');
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const { data: validation, isFetching: validating } = useValidateReferralCode(normalized);
  const apply = useApplyReferralCode();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCode('');
      apply.reset();
    }
  }, [open]);

  const handleApply = async () => {
    if (!validation?.valid) return;
    await apply.mutateAsync({ referral_code: normalized });
    onOpenChange(false);
  };

  const isValid = normalized.length === 6 && validation?.valid;
  const isInvalid = normalized.length === 6 && !validating && validation?.valid === false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Gift className="h-4 w-4 text-primary" />
            Apply Referral Code
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Enter a referral code from another gym to link your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">
              Referral Code
            </label>
            <div className="relative">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABC123"
                maxLength={6}
                className={`h-10 font-mono text-center text-lg tracking-[0.4em] uppercase
                  ${isValid ? 'border-success focus-visible:ring-success/30' : ''}
                  ${isInvalid ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                `}
              />
              {normalized.length === 6 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validating && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {isValid && !validating && (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                  {isInvalid && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              )}
            </div>

            {/* Validation feedback */}
            {isValid && validation?.referrer_name && (
              <p className="text-[12px] text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                Valid code from <span className="font-semibold">{validation.referrer_name}</span>
              </p>
            )}
            {isInvalid && (
              <p className="text-[12px] text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                {validation?.message ?? 'Invalid referral code'}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 border-border"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!isValid || apply.isPending}
              onClick={handleApply}
            >
              {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
