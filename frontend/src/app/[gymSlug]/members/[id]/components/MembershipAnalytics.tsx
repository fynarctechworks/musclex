"use client";

import React from "react";
import { CreditCard, DollarSign, RefreshCw } from "lucide-react";
import type { Member } from "@/types";

interface MembershipAnalyticsProps {
  member: Member;
}

export function MembershipAnalytics({ member }: MembershipAnalyticsProps) {
  const memberships = member.memberships ?? [];
  const totalMemberships = memberships.length;

  // Calculate lifetime value from payments
  const payments = member.payments ?? [];
  const lifetimeValue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Renewal rate: how many memberships were renewed vs expired/cancelled
  const completed = memberships.filter(
    (m) => m.status === "expired" || m.status === "cancelled" || m.status === "renewed"
  ).length;
  const renewed = memberships.filter((m) => m.status === "renewed").length;
  const renewalRate = completed > 0 ? Math.round((renewed / completed) * 100) : 0;

  const stats = [
    { label: "Total Memberships", value: totalMemberships, icon: CreditCard },
    { label: "Lifetime Value", value: `₹${lifetimeValue.toLocaleString()}`, icon: DollarSign },
    { label: "Renewal Rate", value: `${renewalRate}%`, icon: RefreshCw },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Membership Analytics
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 rounded-md bg-canvas-soft border border-border p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-canvas-soft-2">
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
