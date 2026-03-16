"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, LoadingSkeleton, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
} from "@/features/marketing/hooks";
import { workflowsApi } from "@/features/marketing/api";
import type { AutomationWorkflow, TriggerEvent, ActionType } from "@/features/marketing/types";
import {
  Plus,
  Megaphone,
  FileText,
  Zap,
  Users2,
  Trash2,
  MoreHorizontal,
  Play,
  Pause,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { FormInput, FormSelect } from "@/components/shared";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/services/query-client";
import { toast } from "sonner";

const subNavItems = [
  { label: "Campaigns", href: "/marketing", icon: Megaphone },
  { label: "Templates", href: "/marketing/templates", icon: FileText },
  { label: "Automation", href: "/marketing/automation", icon: Zap },
  { label: "Leads", href: "/marketing/leads", icon: Users2 },
];

const triggerLabels: Record<TriggerEvent, string> = {
  membership_expiring: "Membership Expiring",
  member_inactive: "Member Inactive",
  lead_created: "New Lead Created",
  class_missed: "Class Missed",
  birthday: "Member Birthday",
  payment_failed: "Payment Failed",
};

const triggerOptions = Object.entries(triggerLabels).map(([value, label]) => ({
  label,
  value,
}));

const actionTypeLabels: Record<ActionType, string> = {
  send_email: "Send Email",
  send_sms: "Send SMS",
  send_whatsapp: "Send WhatsApp",
  send_push: "Push Notification",
  assign_task: "Assign Task",
  update_status: "Update Status",
};

const actionIcons: Record<string, typeof Mail> = {
  send_email: Mail,
  send_sms: Smartphone,
  send_whatsapp: MessageSquare,
  send_push: Bell,
};

const statusFilters = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Archived", value: "archived" },
];

interface WorkflowFormData {
  workflow_name: string;
  trigger_event: TriggerEvent;
  first_action_type: ActionType;
  first_action_delay: string;
}

export default function AutomationPage() {
  const { gymPath } = useGymSlug();
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationWorkflow | null>(null);

  const { data, isLoading } = useWorkflows({
    status: statusFilter || undefined,
  });

  const workflows: AutomationWorkflow[] = Array.isArray(data) ? data : (data as { data?: AutomationWorkflow[] })?.data ?? [];

  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();

  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success("Workflow deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <PageHeader
        title="Marketing"
        description="Manage campaigns, templates, automation, and leads"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Workflow
          </button>
        }
        className="mb-4"
      />

      {/* Sub-navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {subNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/marketing/automation";
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
      <div className="flex gap-1 mb-4">
        {statusFilters.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setStatusFilter(sf.value)}
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

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : workflows.length === 0 ? (
        <EmptyState
          title="No automation workflows"
          description="Create workflows to automatically engage members based on triggers like expiring memberships, inactivity, or birthdays."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Workflow
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={cn(
                "bg-card border rounded-xl p-5 transition-colors",
                wf.status === "active" ? "border-primary/30" : "border-border"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      wf.status === "active" ? "bg-primary/10" : "bg-muted"
                    )}
                  >
                    <Zap
                      className={cn(
                        "w-5 h-5",
                        wf.status === "active" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{wf.workflow_name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Trigger: {triggerLabels[wf.trigger_event] ?? wf.trigger_event}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded-full font-medium",
                          wf.status === "active"
                            ? "bg-green-500/10 text-green-500"
                            : wf.status === "paused"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {wf.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(wf.created_at), "MMM d, yyyy")}
                      </span>
                    </div>

                    {/* Actions preview */}
                    {wf.actions && wf.actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {wf.actions.map((action, idx) => {
                          const ActionIcon = actionIcons[action.action_type] ?? Zap;
                          return (
                            <div key={action.id ?? idx} className="flex items-center gap-1">
                              {idx > 0 && (
                                <div className="flex items-center text-muted-foreground">
                                  <Clock className="w-3 h-3 mr-0.5" />
                                  <span className="text-[10px]">{action.delay_minutes ?? 0}m</span>
                                  <span className="mx-1">→</span>
                                </div>
                              )}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground text-[10px] rounded">
                                <ActionIcon className="w-3 h-3" />
                                {actionTypeLabels[action.action_type] ?? action.action_type}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle active/paused */}
                  <button
                    onClick={() => {
                      const newStatus = wf.status === "active" ? "paused" : "active";
                      updateMutation.mutate({ id: wf.id, data: { status: newStatus } });
                    }}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors",
                      wf.status === "active" ? "bg-primary" : "bg-border"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
                        wf.status === "active" ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {wf.status === "active" ? (
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: wf.id, data: { status: "paused" } })}>
                          <Pause className="w-4 h-4 mr-2" /> Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: wf.id, data: { status: "active" } })}>
                          <Play className="w-4 h-4 mr-2" /> Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => updateMutation.mutate({ id: wf.id, data: { status: "archived" } })}>
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(wf)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Workflow Dialog */}
      <CreateWorkflowDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          createMutation.mutate(data, { onSuccess: () => setShowCreate(false) });
        }}
        loading={createMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Workflow"
        description={`Are you sure you want to delete "${deleteTarget?.workflow_name}"? This action cannot be undone.`}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
        loading={deleteMutation.isPending}
        variant="danger"
      />
    </AppLayout>
  );
}

function CreateWorkflowDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Parameters<ReturnType<typeof useCreateWorkflow>["mutate"]>[0]) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<WorkflowFormData>();

  const actionTypeOptions = Object.entries(actionTypeLabels).map(([value, label]) => ({
    label,
    value,
  }));

  const onFormSubmit = (data: WorkflowFormData) => {
    onSubmit({
      workflow_name: data.workflow_name,
      trigger_event: data.trigger_event,
      actions: [
        {
          action_type: data.first_action_type,
          delay_minutes: parseInt(data.first_action_delay) || 0,
          action_order: 1,
        },
      ],
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Automation Workflow</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <FormInput
            label="Workflow Name"
            {...register("workflow_name", { required: "Name is required" })}
            placeholder="e.g. Expiry Renewal Reminder"
            error={errors.workflow_name?.message}
          />
          <FormSelect
            label="Trigger Event"
            {...register("trigger_event", { required: "Trigger is required" })}
            options={triggerOptions}
            error={errors.trigger_event?.message}
          />

          <div className="border border-border rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">First Action</h4>
            <FormSelect
              label="Action Type"
              {...register("first_action_type", { required: "Action type is required" })}
              options={actionTypeOptions}
              error={errors.first_action_type?.message}
            />
            <FormInput
              label="Delay (minutes)"
              type="number"
              {...register("first_action_delay")}
              placeholder="0"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            You can add more actions after creating the workflow.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Workflow"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
