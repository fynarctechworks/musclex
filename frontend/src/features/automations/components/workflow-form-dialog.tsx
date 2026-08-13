"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddWorkflowAction,
  useCreateWorkflow,
  useRemoveWorkflowAction,
  useUpdateWorkflow,
} from "../hooks";
import {
  ACTION_META,
  LIVE_TRIGGERS,
  TRIGGER_META,
  type ActionType,
  type AutomationWorkflow,
  type MessageTemplate,
  type TriggerEvent,
  type WorkflowActionInput,
} from "../types";

const DEFAULT_TEMPLATE_VALUE = "__default__";

interface ActionRowDraft {
  action_type: ActionType;
  delay_minutes: string;
  template_id: string; // DEFAULT_TEMPLATE_VALUE = no template (default message)
}

const emptyActionRow = (): ActionRowDraft => ({
  action_type: "send_whatsapp",
  delay_minutes: "0",
  template_id: DEFAULT_TEMPLATE_VALUE,
});

function toActionInput(row: ActionRowDraft, order: number): WorkflowActionInput {
  return {
    action_order: order,
    action_type: row.action_type,
    delay_minutes: Math.max(0, parseInt(row.delay_minutes, 10) || 0),
    template_id: row.template_id === DEFAULT_TEMPLATE_VALUE ? undefined : row.template_id,
  };
}

/** Template picker filtered to the channel matching the selected action type. */
function TemplateSelect({
  actionType,
  value,
  onChange,
  templates,
}: {
  actionType: ActionType;
  value: string;
  onChange: (v: string) => void;
  templates: MessageTemplate[];
}) {
  const channel = ACTION_META[actionType].channel;
  const matching = templates.filter((t) => t.channel === channel && t.is_active);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 bg-muted border-border text-sm">
        <SelectValue placeholder="Template" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        <SelectItem value={DEFAULT_TEMPLATE_VALUE}>Default message</SelectItem>
        {matching.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.template_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActionRowEditor({
  row,
  onChange,
  onRemove,
  templates,
  removable,
}: {
  row: ActionRowDraft;
  onChange: (row: ActionRowDraft) => void;
  onRemove?: () => void;
  templates: MessageTemplate[];
  removable: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_100px_1fr_auto]">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Action</Label>
        <Select
          value={row.action_type}
          onValueChange={(v) =>
            onChange({ ...row, action_type: v as ActionType, template_id: DEFAULT_TEMPLATE_VALUE })
          }
        >
          <SelectTrigger className="h-9 bg-muted border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {(Object.keys(ACTION_META) as ActionType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {ACTION_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Delay (min)</Label>
        <Input
          type="number"
          min={0}
          value={row.delay_minutes}
          onChange={(e) => onChange({ ...row, delay_minutes: e.target.value })}
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Template</Label>
        <TemplateSelect
          actionType={row.action_type}
          value={row.template_id}
          onChange={(v) => onChange({ ...row, template_id: v })}
          templates={templates}
        />
      </div>
      {removable && onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 text-muted-foreground hover:text-error-deep"
          aria-label="Remove action"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <div className="hidden sm:block sm:w-9" />
      )}
    </div>
  );
}

function VariablesHelper() {
  return (
    <p className="text-[11px] leading-4 text-muted-foreground">
      Template bodies support{" "}
      <code className="font-mono">
        {"{{member_name}} {{plan_name}} {{expiry_date}} {{gym_name}} {{days_left}} {{lead_name}}"}
      </code>{" "}
      — they are filled in per member when the automation runs.
    </p>
  );
}

export function WorkflowFormDialog({
  open,
  onOpenChange,
  workflow,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode; a workflow = edit mode */
  workflow: AutomationWorkflow | null;
  templates: MessageTemplate[];
}) {
  const isEdit = !!workflow;

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerEvent>("membership_expiring");
  const [daysBefore, setDaysBefore] = useState("3");
  const [actionRows, setActionRows] = useState<ActionRowDraft[]>([emptyActionRow()]);
  // Edit-mode "add another action" draft
  const [newAction, setNewAction] = useState<ActionRowDraft | null>(null);

  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const addActionMutation = useAddWorkflowAction();
  const removeActionMutation = useRemoveWorkflowAction();

  useEffect(() => {
    if (!open) return;
    if (workflow) {
      setName(workflow.workflow_name);
      const t = (workflow.trigger_event as TriggerEvent) in TRIGGER_META
        ? (workflow.trigger_event as TriggerEvent)
        : "membership_expiring";
      setTrigger(t);
      const cfgDays = (workflow.trigger_config as { days_before_expiry?: number } | null)
        ?.days_before_expiry;
      setDaysBefore(String(cfgDays ?? 3));
    } else {
      setName("");
      setTrigger("membership_expiring");
      setDaysBefore("3");
      setActionRows([emptyActionRow()]);
    }
    setNewAction(null);
  }, [open, workflow]);

  const triggerConfig =
    trigger === "membership_expiring"
      ? { days_before_expiry: Math.max(1, parseInt(daysBefore, 10) || 3) }
      : undefined;

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (isEdit) {
      updateMutation.mutate(
        {
          id: workflow!.id,
          data: {
            workflow_name: name.trim(),
            trigger_event: trigger,
            ...(triggerConfig ? { trigger_config: triggerConfig } : {}),
          },
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(
        {
          workflow_name: name.trim(),
          trigger_event: trigger,
          ...(triggerConfig ? { trigger_config: triggerConfig } : {}),
          actions: actionRows.map((r, i) => toActionInput(r, i + 1)),
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;
  const liveTrigger = LIVE_TRIGGERS.has(trigger);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Edit Automation" : "New Automation"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="workflow-name">Name</Label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Expiry reminder — 3 days before"
            />
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <Label>Trigger</Label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as TriggerEvent)}>
              <SelectTrigger className="bg-muted border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(Object.keys(TRIGGER_META) as TriggerEvent[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      {TRIGGER_META[t].label}
                      {LIVE_TRIGGERS.has(t) ? (
                        <Badge variant="success" size="sm">runs automatically</Badge>
                      ) : (
                        <Badge variant="outline" size="sm">coming soon</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{TRIGGER_META[trigger].hint}</p>
            {!liveTrigger && (
              <p className="text-[11px] text-warning-deep">
                This trigger does not fire yet — the automation will be saved but stays dormant
                until it is wired up.
              </p>
            )}
          </div>

          {/* Days before expiry (membership_expiring only) */}
          {trigger === "membership_expiring" && (
            <div className="space-y-1.5">
              <Label htmlFor="days-before">Days before expiry</Label>
              <Input
                id="days-before"
                type="number"
                min={1}
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
                className="w-32"
              />
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 rounded-lg border border-hairline p-4">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Actions
            </h4>

            {isEdit ? (
              <>
                {/* Existing actions — removed via API immediately */}
                {workflow!.actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No actions yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {workflow!.actions.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-canvas-soft-2 px-3 py-2"
                      >
                        <div className="min-w-0 text-sm text-foreground">
                          <span className="font-medium">
                            {ACTION_META[a.action_type as ActionType]?.label ?? a.action_type}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {a.delay_minutes ? `after ${a.delay_minutes} min · ` : ""}
                            {a.template?.template_name ?? "Default message"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-error-deep"
                          disabled={removeActionMutation.isPending}
                          onClick={() =>
                            removeActionMutation.mutate({
                              workflowId: workflow!.id,
                              actionId: a.id,
                            })
                          }
                          aria-label="Remove action"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add another action */}
                {newAction ? (
                  <div className="space-y-2 rounded-md border border-dashed border-hairline p-3">
                    <ActionRowEditor
                      row={newAction}
                      onChange={setNewAction}
                      templates={templates}
                      removable={false}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewAction(null)}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={addActionMutation.isPending}
                        onClick={() =>
                          addActionMutation.mutate(
                            {
                              workflowId: workflow!.id,
                              action: toActionInput(newAction, workflow!.actions.length + 1),
                            },
                            { onSuccess: () => setNewAction(null) },
                          )
                        }
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {addActionMutation.isPending ? "Adding…" : "Add action"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewAction(emptyActionRow())}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add action
                  </Button>
                )}
              </>
            ) : (
              <>
                {actionRows.map((row, idx) => (
                  <ActionRowEditor
                    key={idx}
                    row={row}
                    onChange={(next) =>
                      setActionRows((rows) => rows.map((r, i) => (i === idx ? next : r)))
                    }
                    onRemove={() =>
                      setActionRows((rows) => rows.filter((_, i) => i !== idx))
                    }
                    templates={templates}
                    removable={actionRows.length > 1}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActionRows((rows) => [...rows, emptyActionRow()])}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add action
                </Button>
              </>
            )}

            <VariablesHelper />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !name.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
