"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, LoadingSkeleton, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  useMessageTemplates,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
  useDeleteMessageTemplate,
} from "@/features/marketing/hooks";
import type { MessageTemplate, TemplateChannel } from "@/features/marketing/types";
import { Plus, Megaphone, FileText, Zap, Users2, Pencil, Trash2, MoreHorizontal, Mail, MessageSquare, Smartphone, Bell } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared";
import { format } from "date-fns";

const subNavItems = [
  { label: "Campaigns", href: "/marketing", icon: Megaphone },
  { label: "Templates", href: "/marketing/templates", icon: FileText },
  { label: "Automation", href: "/marketing/automation", icon: Zap },
  { label: "Leads", href: "/marketing/leads", icon: Users2 },
];

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

export default function TemplatesPage() {
  const { gymPath } = useGymSlug();
  const [channelFilter, setChannelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);

  const { data, isLoading } = useMessageTemplates({
    channel: channelFilter || undefined,
    search: search || undefined,
  });

  const templates: MessageTemplate[] = Array.isArray(data) ? data : (data as { data?: MessageTemplate[] })?.data ?? [];

  const createMutation = useCreateMessageTemplate();
  const updateMutation = useUpdateMessageTemplate();
  const deleteMutation = useDeleteMessageTemplate();

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
            <Plus className="w-4 h-4" /> New Template
          </button>
        }
        className="mb-4"
      />

      {/* Sub-navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {subNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/marketing/templates";
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
                      t.is_active ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
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
    </AppLayout>
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

  // Reset form when template changes
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
