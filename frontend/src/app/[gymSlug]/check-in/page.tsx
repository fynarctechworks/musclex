"use client";

import { useQuery } from "@tanstack/react-query";
import { QrCode, Wifi, ScanFace, Search, Clock, History } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import type { CheckIn, PaginatedResponse } from "@/lib/types";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

const methods = [
  { label: "QR Scan", icon: QrCode, href: "/check-in/qr", enabled: true },
  { label: "RFID", icon: Wifi, href: "#", enabled: false },
  { label: "Face ID", icon: ScanFace, href: "/check-in/facial", enabled: true },
  { label: "Manual", icon: Search, href: "/check-in/manual", enabled: true },
];

export default function CheckInPage() {
  const { gymPath } = useGymSlug();
  const { data: recentData } = useQuery({
    queryKey: ["recent-checkins"],
    queryFn: () => apiClient.get<PaginatedResponse<CheckIn>>("/check-ins?limit=10"),
    refetchInterval: 5000,
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Front Desk Check-in</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a check-in method</p>
        </div>
        <Link href={gymPath("/check-in/history")}>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
            <History className="mr-2 h-4 w-4" /> History
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {methods.map((m) => (
            <Link
              key={m.label}
              href={m.enabled ? m.href : "#"}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border p-8 transition-colors ${
                m.enabled
                  ? "border-border bg-card hover:border-primary cursor-pointer"
                  : "border-border bg-muted opacity-50 cursor-not-allowed"
              }`}
            >
              <m.icon className={`h-10 w-10 ${m.enabled ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium text-foreground">{m.label}</span>
              {!m.enabled && (
                <span className="text-xs bg-background text-muted-foreground px-2 py-0.5 rounded">Coming Soon</span>
              )}
            </Link>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Recent Check-ins
          </h2>
          <div className="space-y-3">
            {recentData?.data?.map((ci) => (
              <div key={ci.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-foreground">{ci.member?.full_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{ci.checkin_method} • {format(new Date(ci.checked_in_at), "h:mm a")}</p>
                </div>
                <StatusBadge status={ci.status === "success" ? "active" : "expired"} />
              </div>
            )) || <p className="text-sm text-muted-foreground">No recent check-ins</p>}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
