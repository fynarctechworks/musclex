"use client";

import { useState } from "react";
import { FileText, Pencil, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequirePermission } from "@/hooks/use-require-permission";
import {
  CHANNEL_LABEL,
  LIVE_TRIGGERS,
  TRIGGER_META,
  TemplateFormDialog,
  WorkflowFormDialog,
  useAutomationTemplates,
  useAutomationWorkflows,
  useDeleteWorkflow,
  useSeedStarterPack,
  useUpdateWorkflow,
  type AutomationWorkflow,
  type TemplateChannel,
  type TriggerEvent,
} from "@/features/automations";

function TriggerBadge({ trigger }: { trigger: string }) {
  const meta = TRIGGER_META[trigger as TriggerEvent];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="default" size="sm">
        {meta?.label ?? trigger}
      </Badge>
      {LIVE_TRIGGERS.has(trigger) ? (
        <Badge variant="success" size="sm">runs automatically</Badge>
      ) : (
        <Badge variant="outline" size="sm">coming soon</Badge>
      )}
    </div>
  );
}

export default function AutomationsPage() {
  const { allowed, checked } = useRequirePermission("marketing", "view", "deny");

  const [tab, setTab] = useState("automations");
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [editWorkflow, setEditWorkflow] = useState<AutomationWorkflow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationWorkflow | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const { data: workflowsData, isLoading: workflowsLoading } = useAutomationWorkflows();
  const { data: templatesData, isLoading: templatesLoading } = useAutomationTemplates();

  const workflows = workflowsData ?? [];
  const templates = templatesData ?? [];
  // Show archived workflows out of the main flow — status toggle covers active/paused.
  const visibleWorkflows = workflows.filter((w) => w.status !== "archived");

  const updateMutation = useUpdateWorkflow();
  const deleteMutation = useDeleteWorkflow();
  const seedMutation = useSeedStarterPack();

  // Keep the edit dialog fed with fresh data after action add/remove refetches.
  const liveEditWorkflow = editWorkflow
    ? workflows.find((w) => w.id === editWorkflow.id) ?? editWorkflow
    : null;

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="marketing" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Marketing"
          title="Automations"
          description="Send WhatsApp, email, SMS or push messages automatically when things happen — expiring memberships and birthdays run in the daily 10:00 sweep, new-lead automations fire instantly."
          actions={
            tab === "automations" ? (
              <Button
                onClick={() => {
                  setEditWorkflow(null);
                  setWorkflowDialogOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" /> New automation
              </Button>
            ) : (
              <Button
                onClick={() => setTemplateDialogOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" /> New template
              </Button>
            )
          }
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="automations">
              <Zap className="mr-1.5 h-4 w-4" /> Automations
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="mr-1.5 h-4 w-4" /> Message Templates
            </TabsTrigger>
          </TabsList>

          {/* ── Automations ───────────────────────────────── */}
          <TabsContent value="automations" className="space-y-4">
            {workflowsLoading ? (
              <TableSkeleton rows={5} />
            ) : visibleWorkflows.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="No automations yet"
                description="Seed a starter pack (expiry reminder, birthday greeting, lead welcome) or build your own from scratch."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      onClick={() => seedMutation.mutate()}
                      disabled={seedMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {seedMutation.isPending ? "Seeding…" : "Seed starter pack"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditWorkflow(null);
                        setWorkflowDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> New automation
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24 text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleWorkflows.map((wf) => {
                      const actionsCount = wf._count?.actions ?? wf.actions.length;
                      const isActive = wf.status === "active";
                      return (
                        <TableRow key={wf.id}>
                          <TableCell className="font-medium text-foreground">
                            {wf.workflow_name}
                          </TableCell>
                          <TableCell>
                            <TriggerBadge trigger={wf.trigger_event} />
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {actionsCount}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={isActive}
                                disabled={updateMutation.isPending}
                                onCheckedChange={(checked) =>
                                  updateMutation.mutate({
                                    id: wf.id,
                                    data: { status: checked ? "active" : "paused" },
                                  })
                                }
                                aria-label={isActive ? "Pause automation" : "Activate automation"}
                              />
                              <span className="text-xs text-muted-foreground">
                                {isActive ? "Active" : "Paused"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditWorkflow(wf);
                                  setWorkflowDialogOpen(true);
                                }}
                                aria-label="Edit automation"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-error-deep"
                                onClick={() => setDeleteTarget(wf)}
                                aria-label="Delete automation"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── Message templates ─────────────────────────── */}
          <TabsContent value="templates" className="space-y-4">
            {templatesLoading ? (
              <TableSkeleton rows={5} />
            ) : templates.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No message templates"
                description="Templates are reusable message bodies your automations send. Create one, or seed the starter pack from the Automations tab."
                action={
                  <Button
                    onClick={() => setTemplateDialogOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4" /> New template
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-foreground">
                          {t.template_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" size="sm">
                            {CHANNEL_LABEL[t.channel as TemplateChannel] ?? t.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="truncate text-sm text-muted-foreground">
                            {t.subject ? `${t.subject} — ` : ""}
                            {t.content}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.is_active ? "success" : "outline"} size="sm">
                            {t.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────── */}
      <WorkflowFormDialog
        open={workflowDialogOpen}
        onOpenChange={(open) => {
          setWorkflowDialogOpen(open);
          if (!open) setEditWorkflow(null);
        }}
        workflow={liveEditWorkflow}
        templates={templates}
      />
      <TemplateFormDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Automation"
        description={`Delete "${deleteTarget?.workflow_name ?? ""}"? Its actions are removed too. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id, {
              onSettled: () => setDeleteTarget(null),
            });
          }
        }}
      />
    </AppLayout>
  );
}
