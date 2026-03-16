'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCancelMembership } from '../hooks';

interface CancelSubscriptionDialogProps {
  memberId: string;
  membershipId: string;
  memberName: string;
  open: boolean;
  onClose: () => void;
}

export function CancelSubscriptionDialog({
  memberId,
  membershipId,
  memberName,
  open,
  onClose,
}: CancelSubscriptionDialogProps) {
  const [reason, setReason] = useState('');
  const cancel = useCancelMembership(membershipId, memberId);

  const handleConfirm = () => {
    cancel.mutate(
      { reason: reason || undefined },
      {
        onSuccess: () => {
          setReason('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Membership
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This will cancel the active membership for{' '}
            <span className="font-medium text-foreground">{memberName}</span>.
            The member will lose access at the end of the current billing period.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Reason for cancellation (optional)
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Moving to a different city, health reasons..."
            className="bg-muted border-border text-foreground resize-none"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Keep Membership
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={cancel.isPending}
            variant="destructive"
          >
            {cancel.isPending ? 'Cancelling...' : 'Cancel Membership'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
