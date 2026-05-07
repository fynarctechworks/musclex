"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, LoadingSkeleton, EmptyState , AccessDenied } from "@/components/shared";
import { useLeads, useCreateLead, useLeadFunnel } from "@/features/marketing/hooks";
import type { Lead, LeadSource, LeadFunnel } from "@/features/marketing/types";
import {
  Plus,
  Megaphone,
  FileText,
  Zap,
  Users2,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Eye,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared";
import { format } from "date-fns";
import { useRequirePermission } from "@/hooks/use-require-permission";

const subNavItems = [
  { label: "Campaigns", href: "/marketing", icon: Megaphone },
  { label: "Templates", href: "/marketing/templates", icon: FileText },
  { label: "Automation", href: "/marketing/automation", icon: Zap },
  { label: "Leads", href: "/marketing/leads", icon: Users2 },
];

const statusFilters = [
  { label: "All", value: "" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Trial Scheduled", value: "trial_scheduled" },
  { label: "Converted", value: "converted" },
  { label: "Lost", value: "lost" },
];

const sourceOptions = [
  { label: "Website", value: "website" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook Ads", value: "facebook_ads" },
  { label: "Walk-in", value: "walk_in" },
  { label: "Referral", value: "referral" },
  { label: "Google Ads", value: "google_ads" },
];

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500",
  contacted: "bg-yellow-500/10 text-yellow-500",
  trial_scheduled: "bg-purple-500/10 text-purple-400",
  converted: "bg-success/10 text-success",
  lost: "bg-red-500/10 text-red-400",
};

interface CreateLeadForm {
  full_name: string;
  email: string;
  phone: string;
  lead_source: LeadSource;
  notes: string;
}

export default function LeadsPage() {
  const { allowed, checked } = useRequirePermission("marketing", "view", "deny");
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const limit = 20;

  const { data, isLoading } = useLeads({
    page,
    limit,
    status: statusFilter || undefined,
    search: search || undefined,
    branch_id: activeBranchId || undefined,
  });

  const { data: funnelData } = useLeadFunnel();
  const funnel = (funnelData as { funnel?: LeadFunnel } | undefined)?.funnel;

  const leads: Lead[] = (data as { data?: Lead[] })?.data ?? [];
  const total = (data as { total?: number })?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const createMutation = useCreateLead();

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="marketing" />
      </AppLayout>
    );
  }

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
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        }
        className="mb-4"
      />

      {/* Sub-navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {subNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/marketing/leads";
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

      {/* Funnel Overview */}
      {funnel && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {Object.entries(funnel).map(([key, count]) => (
            <div key={key} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{count as number}</p>
              <p className="text-xs text-muted-foreground capitalize">{key.replace("_", " ")}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-64"
          />
        </div>
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
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Start tracking potential members by adding leads from inquiries, walk-ins, and social media."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          }
        />
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={gymPath(`/marketing/leads/${lead.id}`)} className="hover:underline">
                        <p className="text-sm text-foreground font-medium">{lead.full_name}</p>
                      </Link>
                      {lead.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{lead.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {lead.email && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded capitalize">
                        {lead.lead_source.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 text-xs rounded-full font-medium capitalize", statusColors[lead.status] ?? "bg-muted text-muted-foreground")}>
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {format(new Date(lead.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={gymPath(`/marketing/leads/${lead.id}`)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground inline-flex"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{total} leads</p>
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

      {/* Create Lead Dialog */}
      <CreateLeadDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          createMutation.mutate(data, { onSuccess: () => setShowCreate(false) });
        }}
        loading={createMutation.isPending}
      />
    </AppLayout>
  );
}

function CreateLeadDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Parameters<ReturnType<typeof useCreateLead>["mutate"]>[0]) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateLeadForm>();

  const onFormSubmit = (data: CreateLeadForm) => {
    onSubmit({
      full_name: data.full_name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      lead_source: data.lead_source,
      notes: data.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <FormInput
            label="Full Name"
            {...register("full_name", { required: "Name is required" })}
            placeholder="John Doe"
            error={errors.full_name?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Email"
              type="email"
              {...register("email")}
              placeholder="john@example.com"
            />
            <FormInput
              label="Phone"
              {...register("phone")}
              placeholder="+91 98765 43210"
            />
          </div>
          <FormSelect
            label="Lead Source"
            {...register("lead_source", { required: "Source is required" })}
            options={sourceOptions}
            error={errors.lead_source?.message}
          />
          <FormTextarea
            label="Notes"
            {...register("notes")}
            placeholder="Any additional notes about this lead..."
            rows={3}
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
              {loading ? "Adding..." : "Add Lead"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
