"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton, EmptyState, FormSelect, FormTextarea , AccessDenied } from "@/components/shared";
import { useLead, useLeadActivities, useUpdateLead, useAddLeadActivity } from "@/features/marketing/hooks";
import type { Lead, LeadActivity, LeadStatus } from "@/features/marketing/types";
import {
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  MessageSquare,
  Calendar,
  StickyNote,
  ArrowRightLeft,
  Users,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { useRequirePermission } from "@/hooks/use-require-permission";

const statusOptions = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Trial Scheduled", value: "trial_scheduled" },
  { label: "Converted", value: "converted" },
  { label: "Lost", value: "lost" },
];

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  trial_scheduled: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  converted: "bg-success/10 text-success border-success/20",
  lost: "bg-red-500/10 text-red-400 border-red-500/20",
};

const activityIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  visit: Eye,
  trial_booking: Calendar,
  note: StickyNote,
  status_change: ArrowRightLeft,
};

const activityTypeOptions = [
  { label: "Phone Call", value: "call" },
  { label: "Email", value: "email" },
  { label: "Visit", value: "visit" },
  { label: "Trial Booking", value: "trial_booking" },
  { label: "Note", value: "note" },
];

interface ActivityFormData {
  activity_type: string;
  notes: string;
}

export default function LeadDetailPage() {
  const { allowed, checked } = useRequirePermission("marketing", "view", "deny");
  const { gymPath } = useGymSlug();
  const params = useParams();
  const leadId = params.id as string;
  const [showAddActivity, setShowAddActivity] = useState(false);

  const { data: leadData, isLoading } = useLead(leadId);
  const { data: activitiesData } = useLeadActivities(leadId);
  const updateMutation = useUpdateLead();
  const addActivityMutation = useAddLeadActivity();

  const lead = leadData as Lead | undefined;
  const activities: LeadActivity[] = Array.isArray(activitiesData)
    ? activitiesData
    : (activitiesData as { data?: LeadActivity[] })?.data ?? [];

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingSkeleton className="h-96" />
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <EmptyState title="Lead not found" description="This lead does not exist or was deleted." />
      </AppLayout>
    );
  }

  const handleStatusChange = (newStatus: LeadStatus) => {
    updateMutation.mutate({
      id: leadId,
      data: { status: newStatus },
    });
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="marketing" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/marketing/leads")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{lead.full_name}</h1>
                <span className={cn("px-2 py-0.5 text-xs rounded-full font-medium capitalize", statusColors[lead.status] ?? "bg-muted text-muted-foreground")}>
                  {lead.status.replace("_", " ")}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{lead.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground capitalize">{lead.lead_source.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Added {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
              </div>
            </div>

            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm text-foreground">{lead.notes}</p>
              </div>
            )}
          </div>

          {/* Status Update */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-foreground mb-3">Update Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value as LeadStatus)}
                  disabled={lead.status === opt.value || updateMutation.isPending}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                    lead.status === opt.value
                      ? statusColors[opt.value] ?? "bg-muted text-muted-foreground border-border"
                      : "bg-background text-muted-foreground border-border hover:bg-muted disabled:opacity-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Activity Timeline</h2>
            <button
              onClick={() => setShowAddActivity(true)}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Log Activity
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activities recorded yet.</p>
              <button
                onClick={() => setShowAddActivity(true)}
                className="text-xs text-primary hover:underline mt-2 inline-block"
              >
                Log the first activity
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {activities.map((activity, idx) => {
                const Icon = activityIcons[activity.activity_type] ?? StickyNote;
                return (
                  <div key={activity.id} className="flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="p-2 rounded-full bg-card border border-border">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      {idx < activities.length - 1 && (
                        <div className="w-px flex-1 bg-border min-h-[24px]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-6 flex-1">
                      <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground capitalize">
                            {activity.activity_type.replace("_", " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(activity.created_at), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                        {activity.notes && (
                          <p className="text-sm text-muted-foreground">{activity.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Activity Dialog */}
      <Dialog open={showAddActivity} onOpenChange={setShowAddActivity}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>
          <AddActivityForm
            onSubmit={(data) => {
              addActivityMutation.mutate(
                {
                  leadId,
                  data: {
                    activity_type: data.activity_type as LeadActivity["activity_type"],
                    notes: data.notes || undefined,
                  },
                },
                { onSuccess: () => setShowAddActivity(false) }
              );
            }}
            loading={addActivityMutation.isPending}
            onCancel={() => setShowAddActivity(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function AddActivityForm({
  onSubmit,
  loading,
  onCancel,
}: {
  onSubmit: (data: ActivityFormData) => void;
  loading: boolean;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ActivityFormData>();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormSelect
        label="Activity Type"
        {...register("activity_type", { required: "Type is required" })}
        options={activityTypeOptions}
        error={errors.activity_type?.message}
      />
      <FormTextarea
        label="Notes"
        {...register("notes")}
        placeholder="Details about this interaction..."
        rows={3}
      />
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Saving..." : "Log Activity"}
        </button>
      </div>
    </form>
  );
}
