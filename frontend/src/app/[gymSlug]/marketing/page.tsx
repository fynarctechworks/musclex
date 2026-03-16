"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton, PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import { useCampaigns, useDeleteCampaign, useSendCampaign } from "@/features/marketing/hooks";
import type { Campaign } from "@/features/marketing/types";
import { Plus, Zap, ChevronLeft, ChevronRight, Megaphone, FileText, Users2, Send, Trash2, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const subNavItems = [
  { label: "Campaigns", href: "/marketing", icon: Megaphone },
  { label: "Templates", href: "/marketing/templates", icon: FileText },
  { label: "Automation", href: "/marketing/automation", icon: Zap },
  { label: "Leads", href: "/marketing/leads", icon: Users2 },
];

const statusFilters = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Sent", value: "sent" },
  { label: "Failed", value: "failed" },
];

export default function MarketingPage() {
  const { gymPath } = useGymSlug();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [sendTarget, setSendTarget] = useState<Campaign | null>(null);
  const limit = 20;

  const { data, isLoading } = useCampaigns({
    page,
    limit,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const deleteMutation = useDeleteCampaign();
  const sendMutation = useSendCampaign();

  const campaigns = (data as { data?: Campaign[]; total?: number })?.data ?? [];
  const total = (data as { total?: number })?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <AppLayout>
      <PageHeader
        title="Marketing"
        description="Manage campaigns, templates, automation, and leads"
        actions={
          <Link
            href={gymPath("/marketing/campaigns/new")}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </Link>
        }
        className="mb-4"
      />

      {/* Sub-navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {subNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/marketing";
          return (
            <Link
              key={item.href}
              href={gymPath(item.href)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-64"
        />
        <div className="flex gap-1">
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => { setStatusFilter(sf.value); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === sf.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start reaching out to members."
          action={
            <Link
              href={gymPath("/marketing/campaigns/new")}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Campaign
            </Link>
          }
        />
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
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={gymPath(`/marketing/campaigns/${campaign.id}`)} className="hover:underline">
                        <p className="text-sm text-foreground font-medium">{campaign.name}</p>
                      </Link>
                      <p className="text-xs text-muted-foreground capitalize">{campaign.segment} members</p>
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
                      {format(new Date(campaign.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={gymPath(`/marketing/campaigns/${campaign.id}`)}>
                              <Eye className="w-4 h-4 mr-2" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          {campaign.status === "draft" && (
                            <DropdownMenuItem onClick={() => setSendTarget(campaign)}>
                              <Send className="w-4 h-4 mr-2" /> Send Now
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(campaign)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{total} campaigns</p>
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

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
              onError: () => setDeleteTarget(null),
            });
          }
        }}
        loading={deleteMutation.isPending}
        variant="danger"
      />

      {/* Send confirmation */}
      <ConfirmDialog
        open={!!sendTarget}
        onOpenChange={(open) => !open && setSendTarget(null)}
        title="Send Campaign"
        description={`Send "${sendTarget?.name}" to all ${sendTarget?.segment} members now?`}
        onConfirm={() => {
          if (sendTarget) {
            sendMutation.mutate(sendTarget.id, { onSuccess: () => setSendTarget(null) });
          }
        }}
        loading={sendMutation.isPending}
      />
    </AppLayout>
  );
}
