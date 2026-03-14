"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Campaign, PaginatedResponse } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { Plus, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function MarketingPage() {
  const { gymPath } = useGymSlug();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<PaginatedResponse<Campaign>>({
    queryKey: ["campaigns", page],
    queryFn: () => apiClient.get(`/campaigns?page=${page}&limit=${limit}`),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage campaigns and automation
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={gymPath("/marketing/automation")}
            className="border border-border text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" /> Automation
          </Link>
          <Link
            href={gymPath("/marketing/campaigns/new")}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </Link>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Channels</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Sent</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Delivered</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Created</th>
                </tr>
              </thead>
              <tbody>
                {data?.data && data.data.length > 0 ? (
                  data.data.map((campaign) => (
                    <tr key={campaign.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground font-medium">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">{campaign.segment}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {campaign.channels.map((ch) => (
                            <span key={ch} className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded capitalize">
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={campaign.status} /></td>
                      <td className="px-4 py-3 text-sm text-foreground text-right">{campaign.sent_count}</td>
                      <td className="px-4 py-3 text-sm text-foreground text-right">{campaign.delivered_count}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No campaigns yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{data?.total ?? 0} campaigns</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
