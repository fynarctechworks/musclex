"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFreezeMember } from "@/features/members";

interface FreezeDialogProps {
  memberId: string;
  memberName: string;
  open: boolean;
  onClose: () => void;
}

export function FreezeDialog({
  memberId,
  memberName,
  open,
  onClose,
}: FreezeDialogProps) {
  const [reason, setReason] = useState("");
  const [endDate, setEndDate] = useState(
    format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd")
  );
  const freezeMutation = useFreezeMember(memberId);

  if (!open) return null;

  const handleFreeze = () => {
    freezeMutation.mutate(
      { reason, end_date: endDate },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-level-5">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Freeze Membership
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Freeze {memberName}&apos;s membership for a period.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Reason *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Medical leave, travel..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Freeze End Date *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleFreeze}
            disabled={freezeMutation.isPending || !reason || !endDate}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Snowflake className="mr-2 h-4 w-4" />
            {freezeMutation.isPending ? "Freezing..." : "Freeze"}
          </Button>
        </div>
      </div>
    </div>
  );
}
