"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface Restatement {
  metric:
    | "active_members"
    | "today_revenue"
    | "mrr"
    | "check_ins_today"
    | "renewals_at_risk_7d"
    | "outstanding_dues";
  prior_date: string;
  prior_value: number;
  current_value: number;
  delta_pct: number;
  is_restated: boolean;
}

/**
 * Fetches the list of metrics whose previously-snapshotted values have
 * meaningfully shifted (≥5% drift). The dashboard surfaces these as
 * "▴ restated" pills so users see when yesterday's numbers changed.
 *
 * Long stale time (5 min) — restatements don't churn within a single
 * session, and we'd rather under-fetch than spam the API.
 */
export function useRestatements(branchId?: string) {
  const params = branchId ? { branch_id: branchId } : undefined;
  const { data } = useQuery<Restatement[]>({
    queryKey: ["dashboard", "restatements", branchId],
    queryFn: () => apiClient.get("/dashboard/restatements", { params }),
    staleTime: 5 * 60_000,
    // Soft-fail: if the table doesn't exist or the request 5xxs, just
    // return [] so the dashboard renders without restatement pills.
    retry: false,
  });
  const map = new Map<Restatement["metric"], Restatement>();
  for (const r of data ?? []) map.set(r.metric, r);
  return map;
}
