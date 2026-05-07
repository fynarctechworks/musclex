"use client";

import { useEffect, useState } from "react";
import { LoadingSkeleton, EmptyState, ConfirmDialog, FormInput, FormSelect, FormTextarea } from "@/components/shared";
import {
  useMessageTemplates,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
  useDeleteMessageTemplate,
} from "@/features/marketing/hooks";
import type { MessageTemplate, TemplateChannel } from "@/features/marketing/types";
import { Plus, Pencil, Trash2, MoreHorizontal, Mail, MessageSquare, Smartphone, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { format } from "date-fns";

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageSquare,
  push_notification: Bell,
};

const channelOptions = [
  { label: "Email", value: "email" },
  { label: "SMS", value: "sms" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Push Notification", value: "push_notification" },
];

const channelFilters = [
  { label: "All", value: "" },
  { label: "Email", value: "email" },
  { label: "SMS", value: "sms" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Push", value: "push_notification" },
];

interface TemplateFormData {
  template_name: string;
  channel: TemplateChannel;
  subject: string;
  content: string;
  variables: string;
}

interface MessageTemplatesManagerProps {
  /** When true, the manager hides its built-in "New Template" button so the page can render its own. */
  hideInternalCreateButton?: boolean;
  /** Increment this number to open the create dialog from a parent (e.g. a header button). */
  openCreateSignal?: number;
  /** Set to a template to open it in the edit dialog. Pass a fresh object reference to re-trigger. */
  editTemplateSignal?: MessageTemplate | null;
}

export function MessageTemplatesManager({
  hideInternalCreateButton,
  openCreateSignal,
  editTemplateSignal,
}: MessageTemplatesManagerProps = {}) {
  const [channelFilter, setChannelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    if (typeof openCreateSignal === "number" && openCreateSignal > 0) {
      setShowCreate(true);
    }
  }, [openCreateSignal]);

  useEffect(() => {
    if (editTemplateSignal) setEditTemplate(editTemplateSignal);
  }, [editTemplateSignal]);

  const { data, isLoading } = useMessageTemplates({
    channel: channelFilter || undefined,
    search: search || undefined,
  });

  const templates: MessageTemplate[] = Array.isArray(data) ? data : (data as { data?: MessageTemplate[] })?.data ?? [];

  const createMutation = useCreateMessageTemplate();
  const updateMutation = useUpdateMessageTemplate();
  const deleteMutation = useDeleteMessageTemplate();

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-64"
        />
        <div className="flex gap-1">
          {channelFilters.map((cf) => (
            <button
              key={cf.value}
              onClick={() => setChannelFilter(cf.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                channelFilter === cf.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cf.label}
            </button>
          ))}
        </div>
        {!hideInternalCreateButton && (
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create reusable message templates for your campaigns and automation."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Template
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => {
            const ChannelIcon = channelIcons[t.channel] ?? Mail;
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ChannelIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{t.template_name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{t.channel.replace("_", " ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] rounded-full font-medium",
                      t.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    )}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTemplate(t)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            updateMutation.mutate({
                              id: t.id,
                              data: { is_active: !t.is_active },
                            });
                          }}
                        >
                          {t.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(t)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {t.subject && (
                  <p className="text-xs text-muted-foreground mb-1">Subject: {t.subject}</p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">{t.content}</p>
                {t.variables && t.variables.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {t.variables.map((v) => (
                      <span key={v} className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded font-mono">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  {format(new Date(t.created_at), "MMM d, yyyy")}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Template Dialog */}
      <TemplateDialog
        open={showCreate || !!editTemplate}
        onClose={() => { setShowCreate(false); setEditTemplate(null); }}
        template={editTemplate}
        onSubmit={(data) => {
          if (editTemplate) {
            updateMutation.mutate(
              { id: editTemplate.id, data },
              { onSuccess: () => setEditTemplate(null) }
            );
          } else {
            createMutation.mutate(data as Parameters<typeof createMutation.mutate>[0], {
              onSuccess: () => setShowCreate(false),
            });
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Template"
        description={`Are you sure you want to delete "${deleteTarget?.template_name}"?`}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
        loading={deleteMutation.isPending}
        variant="danger"
      />
    </>
  );
}

function TemplateDialog({
  open,
  onClose,
  template,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  template: MessageTemplate | null;
  onSubmit: (data: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TemplateFormData>({
    defaultValues: template
      ? {
          template_name: template.template_name,
          channel: template.channel,
          subject: template.subject ?? "",
          content: template.content,
          variables: template.variables?.join(", ") ?? "",
        }
      : undefined,
  });

  const [prevId, setPrevId] = useState<string | null>(null);
  if ((template?.id ?? null) !== prevId) {
    setPrevId(template?.id ?? null);
    if (template) {
      reset({
        template_name: template.template_name,
        channel: template.channel,
        subject: template.subject ?? "",
        content: template.content,
        variables: template.variables?.join(", ") ?? "",
      });
    } else {
      reset({ template_name: "", channel: "email", subject: "", content: "", variables: "" });
    }
  }

  const onFormSubmit = (data: TemplateFormData) => {
    const vars = data.variables
      ? data.variables.split(",").map((v) => v.trim()).filter(Boolean)
      : undefined;
    onSubmit({
      template_name: data.template_name,
      channel: data.channel,
      subject: data.subject || undefined,
      content: data.content,
      variables: vars,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <FormInput
            label="Template Name"
            {...register("template_name", { required: "Name is required" })}
            placeholder="e.g. Membership Renewal Reminder"
            error={errors.template_name?.message}
          />
          <FormSelect
            label="Channel"
            {...register("channel", { required: "Channel is required" })}
            options={channelOptions}
            error={errors.channel?.message}
          />
          <FormInput
            label="Subject (for emails)"
            {...register("subject")}
            placeholder="e.g. Your membership is expiring soon!"
          />
          <FormTextarea
            label="Content"
            {...register("content", { required: "Content is required" })}
            placeholder="Hi {{name}}, your membership expires on {{expiry_date}}..."
            rows={5}
            error={errors.content?.message}
          />
          <FormInput
            label="Variables (comma-separated)"
            {...register("variables")}
            placeholder="name, expiry_date, plan_name"
          />
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
              {loading ? "Saving..." : template ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
