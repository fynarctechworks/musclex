"use client";

import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranches } from "@/features/branches";
import { useTransferMember } from "@/features/membership-access";
import type { Branch } from "@/types";

interface TransferDialogProps {
  memberId: string;
  memberName: string;
  currentBranchId: string;
  open: boolean;
  onClose: () => void;
}

export function TransferDialog({
  memberId,
  memberName,
  currentBranchId,
  open,
  onClose,
}: TransferDialogProps) {
  const [toBranchId, setToBranchId] = useState("");
  const [reason, setReason] = useState("");

  const { data: branches } = useBranches();
  const transfer = useTransferMember(memberId);

  if (!open) return null;

  const candidates =
    (branches as Branch[] | undefined)?.filter(
      (b) => b.id !== currentBranchId && b.is_active !== false,
    ) ?? [];

  const handleSubmit = () => {
    if (!toBranchId) return;
    transfer.mutate(
      { to_branch_id: toBranchId, reason: reason || undefined },
      {
        onSuccess: () => {
          setToBranchId("");
          setReason("");
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-level-5">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Transfer Home Branch
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Change {memberName}&apos;s home branch. Existing memberships keep
          their original branch for revenue attribution; the member will be
          granted access to the new branch automatically.
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              New Home Branch *
            </label>
            <select
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Select a branch…</option>
              {candidates.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.city ? ` — ${b.city}` : ""}
                </option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No other active branches available.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. moved cities, prefers new location…"
              maxLength={500}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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
            onClick={handleSubmit}
            disabled={!toBranchId || transfer.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            {transfer.isPending ? "Transferring…" : "Transfer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
