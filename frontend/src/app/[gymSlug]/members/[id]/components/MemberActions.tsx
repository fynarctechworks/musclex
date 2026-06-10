"use client";

import React from "react";
import {
  RefreshCw,
  Snowflake,
  Pencil,
  UserX,
  UserCheck,
  Sun,
  ScanFace,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Member } from "@/types";
import Link from "next/link";

interface MemberActionsProps {
  member: Member;
  editHref: string;
  onRenew: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onEnrollBiometric?: () => void;
  onTransfer?: () => void;
}

export function MemberActions({
  member,
  editHref,
  onRenew,
  onFreeze,
  onUnfreeze,
  onActivate,
  onDeactivate,
  onEnrollBiometric,
  onTransfer,
}: MemberActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={onRenew}
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Renew
      </Button>

      {member.status === "frozen" ? (
        <Button
          variant="ghost"
          onClick={onUnfreeze}
          className="text-warning border border-warning/30 hover:bg-warning/10"
        >
          <Sun className="mr-2 h-4 w-4" />
          Unfreeze
        </Button>
      ) : (
        <Button
          variant="ghost"
          onClick={onFreeze}
          className="text-primary border border-primary hover:bg-canvas-soft-2"
        >
          <Snowflake className="mr-2 h-4 w-4" />
          Freeze
        </Button>
      )}

      {onEnrollBiometric && (
        <Button
          variant="ghost"
          onClick={onEnrollBiometric}
          className="text-primary border border-primary/30 hover:bg-primary/10"
          title="Capture face for biometric check-in"
        >
          <ScanFace className="mr-2 h-4 w-4" />
          Enroll Face
        </Button>
      )}

      {onTransfer && (
        <Button
          variant="ghost"
          onClick={onTransfer}
          className="text-muted-foreground border border-border hover:text-foreground hover:bg-muted"
          title="Transfer to a different home branch"
        >
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Transfer
        </Button>
      )}

      <Link href={editHref}>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </Link>

      {member.status === "inactive" || member.status === "expired" ? (
        <Button
          variant="ghost"
          onClick={onActivate}
          className="text-primary hover:text-primary hover:bg-canvas-soft-2"
        >
          <UserCheck className="mr-2 h-4 w-4" />
          Activate
        </Button>
      ) : (
        <Button
          variant="ghost"
          onClick={onDeactivate}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <UserX className="mr-2 h-4 w-4" />
          Deactivate
        </Button>
      )}
    </div>
  );
}
