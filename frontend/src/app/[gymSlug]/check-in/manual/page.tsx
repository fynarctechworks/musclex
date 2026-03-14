"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, UserCheck, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import type { Member, PaginatedResponse } from "@/lib/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface CheckInResult {
  success: boolean;
  member_name?: string;
  message?: string;
  failure_reason?: string;
}

export default function ManualCheckInPage() {
  const { gymPath } = useGymSlug();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const branchId = user?.branch_ids?.[0] ?? "";

  const { data: results } = useQuery({
    queryKey: ["member-search", search],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Member>>(
        `/members?search=${encodeURIComponent(search)}&limit=10`
      ),
    enabled: search.length >= 2,
  });

  const checkIn = useMutation({
    mutationFn: (memberId: string) =>
      apiClient.post<CheckInResult>("/check-ins", {
        member_id: memberId,
        branch_id: branchId,
        checkin_method: "manual",
      }),
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast.success(`${selected?.full_name} checked in!`);
        queryClient.invalidateQueries({ queryKey: ["recent-checkins"] });
      } else {
        toast.error(data.failure_reason || data.message || "Check-in failed");
      }
    },
    onError: (err: Error) => {
      setResult({ success: false, message: err.message });
      toast.error(err.message);
    },
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={gymPath("/check-in")} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Manual Check-in</h1>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or member ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            className="pl-9 bg-background border-border text-foreground"
          />
        </div>

        {!selected && results?.data?.map((m) => (
          <button key={m.id} onClick={() => setSelected(m)}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary text-left">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
              {m.full_name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{m.full_name}</p>
              <p className="text-xs text-muted-foreground">{m.member_code} • {m.phone}</p>
            </div>
            <StatusBadge status={m.status} />
          </button>
        ))}

        {selected && (
          <div className="rounded-xl border border-primary bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                {selected.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-foreground">{selected.full_name}</p>
                <p className="text-xs text-muted-foreground">{selected.member_code}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <Button
              onClick={() => checkIn.mutate(selected.id)}
              disabled={checkIn.isPending}
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {checkIn.isPending ? "Checking in..." : "Check In Now"}
            </Button>
          </div>
        )}

        {/* Result Feedback */}
        {result && (
          <div
            className={`rounded-xl border p-4 flex items-center gap-3 ${
              result.success
                ? "border-primary bg-primary/10"
                : "border-destructive bg-destructive/10"
            }`}
          >
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-primary" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {result.success ? "Check-in Successful" : "Check-in Failed"}
              </p>
              <p className="text-xs text-muted-foreground">
                {result.member_name || result.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
