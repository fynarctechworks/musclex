"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton, ConfirmDialog, EmptyState } from "@/components/shared";
import {
  useCampaign,
  useCampaignAnalytics,
  useSendCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
} from "@/features/marketing/hooks";
import { campaignsApi } from "@/features/marketing/api";
import type { CampaignAudienceMember, CampaignAnalytics } from "@/features/marketing/types";
import {
  ArrowLeft,
  Send,
  Trash2,
  Users,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/services/query-client";
import { format } from "date-fns";
import { KPICard } from "@/components/shared";

export default function CampaignDetailPage() {
  const { gymPath } = useGymSlug();
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [showSend, setShowSend] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [audiencePage, setAudiencePage] = useState(1);

  const { data: campaign, isLoading } = useCampaign(campaignId);
  const { data: analyticsData } = useCampaignAnalytics(campaignId);
  const sendMutation = useSendCampaign();
  const deleteMutation = useDeleteCampaign();
  const updateMutation = useUpdateCampaign();

  const { data: audienceData } = useQuery({
    queryKey: queryKeys.marketing.campaignAudience(campaignId, { page: audiencePage }),
    queryFn: () => campaignsApi.getAudience(campaignId, { page: audiencePage, limit: 20 }),
    enabled: !!campaignId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = campaign as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aud = audienceData as any;
  const analytics = analyticsData as CampaignAnalytics | undefined;
  const audience: CampaignAudienceMember[] = aud?.data ?? [];
  const audienceTotal: number = aud?.total ?? 0;
  const audienceTotalPages = Math.ceil(audienceTotal / 20);

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingSkeleton className="h-96" />
      </AppLayout>
    );
  }

  if (!c) {
    return (
      <AppLayout>
        <EmptyState title="Campaign not found" description="This campaign does not exist or was deleted." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/marketing")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Campaigns
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-foreground">{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-muted-foreground capitalize">
            {c.segment} members &middot; Created {format(new Date(c.created_at), "MMM d, yyyy")}
          </p>
          {c.scheduled_at && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Scheduled: {format(new Date(c.scheduled_at), "MMM d, yyyy h:mm a")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {c.status === "draft" && (
            <>
              <button
                onClick={() => updateMutation.mutate({ id: campaignId, data: { status: "scheduled" } })}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                Schedule
              </button>
              <button
                onClick={() => setShowSend(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Now
              </button>
            </>
          )}
          <button
            onClick={() => setShowDelete(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* Channels */}
      <div className="flex gap-2 mb-6">
        {c.channels?.map((ch: string) => (
          <span key={ch} className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-lg capitalize font-medium">
            {ch}
          </span>
        ))}
      </div>

      {/* Message Preview */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-medium text-foreground mb-2">Message Template</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.message_template}</p>
      </div>

      {/* Analytics */}
      {analytics && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Campaign Analytics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KPICard label="Sent" value={analytics.sent} icon={Users} />
            <KPICard label="Opened" value={analytics.opened} icon={MailOpen} />
            <KPICard label="Clicked" value={analytics.clicked} icon={MousePointerClick} />
            <KPICard label="Bounced" value={analytics.bounced} icon={AlertTriangle} />
            <KPICard label="Revenue" value={`$${(analytics.revenue_generated ?? 0).toLocaleString()}`} icon={DollarSign} />
          </div>
          {analytics.sent > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{((analytics.opened / analytics.sent) * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{((analytics.clicked / analytics.sent) * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Click Rate</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{((analytics.bounced / analytics.sent) * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Bounce Rate</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audience List */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">
          Audience ({audienceTotal})
        </h3>
        {audience.length > 0 ? (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Member</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Sent At</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Opened At</th>
                  </tr>
                </thead>
                <tbody>
                  {audience.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground font-medium">{a.member?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{a.member?.email ?? a.member?.phone ?? ""}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {a.sent_at ? format(new Date(a.sent_at), "MMM d, h:mm a") : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {a.opened_at ? format(new Date(a.opened_at), "MMM d, h:mm a") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {audienceTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{audienceTotal} recipients</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAudiencePage((p) => Math.max(1, p - 1))} disabled={audiencePage === 1} className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-muted-foreground">Page {audiencePage} of {audienceTotalPages}</span>
                  <button onClick={() => setAudiencePage((p) => Math.min(audienceTotalPages, p + 1))} disabled={audiencePage === audienceTotalPages} className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            {c.status === "draft" ? "Audience will be built when campaign is sent." : "No audience data available."}
          </div>
        )}
      </div>

      {/* Send confirmation */}
      <ConfirmDialog
        open={showSend}
        onOpenChange={setShowSend}
        title="Send Campaign"
        description={`Send "${c.name}" to all ${c.segment} members now? This action cannot be undone.`}
        onConfirm={() => {
          sendMutation.mutate(campaignId, { onSuccess: () => setShowSend(false) });
        }}
        loading={sendMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${c.name}"? This action cannot be undone.`}
        onConfirm={() => {
          deleteMutation.mutate(campaignId, {
            onSuccess: () => router.push(gymPath("/marketing")),
          });
        }}
        loading={deleteMutation.isPending}
        variant="danger"
      />
    </AppLayout>
  );
}
