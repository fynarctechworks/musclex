'use client';

import * as React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the policy engine said when it denied. */
  denialReason: string | null;
  denialMessage: string | null;
  memberName: string | null;
  /** True only when the current user has check_ins.override permission. */
  canOverride: boolean;
  /** Submits override with the typed reason. */
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

const MIN_REASON_LEN = 6;
const MAX_REASON_LEN = 500;

/**
 * Permission-gated "force allow" prompt that surfaces when the policy
 * engine returned `severity === 'overridable'`.
 *
 * UX guarantees:
 *  - Hidden entirely from users without the override permission.
 *  - Reason is mandatory and persisted to AuditLog + CheckInEvent.
 *  - Member name and denial reason are echoed back so staff confirm intent.
 */
export function OverrideDialog({
  open,
  onOpenChange,
  denialReason,
  denialMessage,
  memberName,
  canOverride,
  onConfirm,
  isSubmitting,
}: OverrideDialogProps) {
  const [reason, setReason] = React.useState('');
  const reasonTrimmed = reason.trim();
  const canSubmit =
    !isSubmitting && canOverride && reasonTrimmed.length >= MIN_REASON_LEN && reasonTrimmed.length <= MAX_REASON_LEN;

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Override required
          </DialogTitle>
          <DialogDescription>
            {memberName ? <>Allow <strong>{memberName}</strong> to check in despite the policy denial?</> : 'Allow this member to check in despite the policy denial?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            <div className="font-medium text-foreground">
              {denialReason ? humanizeReason(denialReason) : 'Denied'}
            </div>
            {denialMessage && <div className="text-muted-foreground">{denialMessage}</div>}
          </div>

          {!canOverride ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have the <code className="rounded bg-muted px-1 py-0.5 text-xs">check_ins.override</code> permission. Ask a manager to authorize this check-in.
            </p>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="override-reason" className="text-sm font-medium text-foreground">
                Reason for override <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="override-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Payment in cash at front desk, receipt #4321"
                rows={3}
                maxLength={MAX_REASON_LEN}
                autoFocus
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>This will be saved to the audit log.</span>
                <span>{reasonTrimmed.length}/{MAX_REASON_LEN}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {canOverride && (
            <Button onClick={() => canSubmit && onConfirm(reasonTrimmed)} disabled={!canSubmit}>
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {isSubmitting ? 'Authorizing…' : 'Allow check-in'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function humanizeReason(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
