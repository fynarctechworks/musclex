"use client";

import React from "react";
import { format } from "date-fns";
import { Pause, Play, XCircle, RefreshCw, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MembershipStatusBadge } from "./MembershipStatusBadge";
import type { MemberMembership } from "@/types";

interface MembershipHistoryTableProps {
  memberships: MemberMembership[];
  onPause: (membership: MemberMembership) => void;
  onResume: (membership: MemberMembership) => void;
  onCancel: (membership: MemberMembership) => void;
  onRenew: (membership: MemberMembership) => void;
}

export function MembershipHistoryTable({
  memberships,
  onPause,
  onResume,
  onCancel,
  onRenew,
}: MembershipHistoryTableProps) {
  if (memberships.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No memberships yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-3 pr-4 font-medium text-muted-foreground">Plan</th>
            <th className="py-3 pr-4 font-medium text-muted-foreground">Start Date</th>
            <th className="py-3 pr-4 font-medium text-muted-foreground">End Date</th>
            <th className="py-3 pr-4 font-medium text-muted-foreground">Visits Left</th>
            <th className="py-3 pr-4 font-medium text-muted-foreground">Status</th>
            <th className="py-3 pr-4 font-medium text-muted-foreground">Auto Renew</th>
            <th className="py-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((m) => {
            const canPause = m.status === "active";
            const canResume = m.status === "paused" || m.status === "frozen";
            const canCancel = m.status === "active" || m.status === "paused" || m.status === "frozen";
            const canRenew = m.status === "expired" || m.status === "cancelled" || m.status === "active";

            return (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 pr-4">
                  <div>
                    <span className="font-medium text-foreground">{m.plan.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ₹{Number(m.plan.price).toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {format(new Date(m.start_date), "MMM dd, yyyy")}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {m.end_date ? format(new Date(m.end_date), "MMM dd, yyyy") : "--"}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {m.remaining_visits ?? m.classes_remaining ?? "∞"}
                </td>
                <td className="py-3 pr-4">
                  <MembershipStatusBadge status={m.status} />
                </td>
                <td className="py-3 pr-4">
                  <span className={m.auto_renew ? "text-primary text-xs" : "text-muted-foreground text-xs"}>
                    {m.auto_renew ? "Yes" : "No"}
                  </span>
                </td>
                <td className="py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {canPause && (
                        <DropdownMenuItem onClick={() => onPause(m)}>
                          <Pause className="mr-2 h-3.5 w-3.5" /> Pause
                        </DropdownMenuItem>
                      )}
                      {canResume && (
                        <DropdownMenuItem onClick={() => onResume(m)}>
                          <Play className="mr-2 h-3.5 w-3.5" /> Resume
                        </DropdownMenuItem>
                      )}
                      {canRenew && (
                        <DropdownMenuItem onClick={() => onRenew(m)}>
                          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Renew
                        </DropdownMenuItem>
                      )}
                      {canCancel && (
                        <DropdownMenuItem onClick={() => onCancel(m)} className="text-destructive focus:text-destructive">
                          <XCircle className="mr-2 h-3.5 w-3.5" /> Cancel
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
