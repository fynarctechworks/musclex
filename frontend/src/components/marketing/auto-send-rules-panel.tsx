"use client";

import { useState } from "react";
import {
  useWorkflows,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useSeedDefaultMessaging,
  useMessageTemplates,
} from "@/features/marketing/hooks";
import type { AutomationWorkflow, MessageTemplate, TriggerEvent } from "@/features/marketing/types";
import { LoadingSkeleton, ConfirmDialog } from "@/components/shared";
import {
  UserPlus,
  CalendarClock,
  RefreshCcw,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ESSENTIAL_RULES: Array<{
  trigger: TriggerEvent;
  title: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    trigger: "member_registered",
    title: "When a member registers",
    description: "Send a welcome message right after sign-up",
    icon: UserPlus,
  },
  {
    trigger: "membership_expiring",
    title: "When a member is about to expire",
    description: "Remind them to renew before their plan ends",
    icon: CalendarClock,
  },
  {
    trigger: "member_renewed",
    title: "When a member renews",
    description: "Thank them and confirm the new expiry date",
    icon: RefreshCcw,
  },
];

interface AutoSendRulesPanelProps {
  onEditTemplate?: (template: MessageTemplate) => void;
}

export function AutoSendRulesPanel({ onEditTemplate }: AutoSendRulesPanelProps) {
  const triggers = ESSENTIAL_RULES.map((r) => r.trigger);
  const { data: allWorkflows, isLoading } = useWorkflows();
  const { data: templatesData } = useMessageTemplates();
  const updateMutation = useUpdateWorkflow();
  const deleteMutation = useDeleteWorkflow();
  const seedMutation = useSeedDefaultMessaging();
  const [deleteTarget, setDeleteTarget] = useState<AutomationWorkflow | null>(null);

  const workflows: AutomationWorkflow[] = Array.isArray(allWorkflows)
    ? (allWorkflows as AutomationWorkflow[]).filter((w) => triggers.includes(w.trigger_event))
    : [];

  const templates: MessageTemplate[] = Array.isArray(templatesData)
    ? (templatesData as MessageTemplate[])
    : (templatesData as { data?: MessageTemplate[] })?.data ?? [];

  const byTrigger = new Map(workflows.map((w) => [w.trigger_event, w]));

  if (isLoading) {
    return <LoadingSkeleton className="h-32 mb-6" />;
  }

  const allMissing = workflows.length === 0;

  if (allMissing) {
    return (
      <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Turn on automatic messages in one click
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            We&apos;ll create five essential templates and three auto-send rules so members
            automatically receive a welcome, an expiry reminder and a renewal thanks. You can edit
            anything afterwards.
          </p>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="mt-3 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {seedMutation.isPending ? "Setting up..." : "Set up default messages"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Auto-send rules</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Messages that fire automatically on key member events
            </p>
          </div>
          {workflows.length < ESSENTIAL_RULES.length && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="text-xs font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {seedMutation.isPending ? "Adding..." : "Add missing defaults"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ESSENTIAL_RULES.map((rule) => {
            const wf = byTrigger.get(rule.trigger);
            const Icon = rule.icon;
            const isActive = wf?.status === "active";
            const linkedTemplateId = wf?.actions?.[0]?.template_id;
            const linkedTemplate = linkedTemplateId
              ? templates.find((t) => t.id === linkedTemplateId)
              : undefined;

            return (
              <div
                key={rule.trigger}
                className={cn(
                  "rounded-lg border p-4 transition-colors bg-card",
                  wf ? "border-border" : "border-dashed border-border/70"
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        isActive ? "bg-canvas-soft-2" : "bg-muted"
                      )}
                    >
                      <Icon
                        className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {rule.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {rule.description}
                      </p>
                    </div>
                  </div>
                  {wf && (
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          id: wf.id,
                          data: { status: isActive ? "paused" : "active" },
                        })
                      }
                      className={cn(
                        "shrink-0 inline-flex items-center h-5 w-9 rounded-full transition-colors",
                        isActive ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                      aria-label={isActive ? "Disable rule" : "Enable rule"}
                      title={isActive ? "Disable" : "Enable"}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded-full bg-background shadow-level-2 transform transition-transform",
                          isActive ? "translate-x-[18px]" : "translate-x-[2px]"
                        )}
                      />
                    </button>
                  )}
                </div>

                {wf ? (
                  <>
                    <div className="rounded-lg bg-canvas-soft border border-border px-3 py-2 mb-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Sends template
                      </p>
                      <p className="text-xs font-medium text-foreground truncate mt-0.5">
                        {linkedTemplate?.template_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                        via {linkedTemplate?.channel?.replace("_", " ") ?? "whatsapp"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full",
                          isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isActive ? "On" : "Off"}
                      </span>
                      {linkedTemplate && (
                        <button
                          onClick={() => onEditTemplate?.(linkedTemplate)}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(wf)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                    className="w-full text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 py-2 rounded-md border border-dashed border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    + Enable this rule
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete auto-send rule"
        description={`Delete "${deleteTarget?.workflow_name}"? Members will no longer receive this message automatically. The underlying template will not be deleted.`}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        loading={deleteMutation.isPending}
        variant="danger"
      />
    </>
  );
}
