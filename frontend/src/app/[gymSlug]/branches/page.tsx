"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FormInput } from "@/components/shared/form-fields";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  Plus,
  Pencil,
  MapPin,
  Phone,
  Mail,
  Users,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { Branch } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface BranchFormData {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

function BranchFormModal({
  branch,
  onClose,
  onSave,
  saving,
}: {
  branch?: Branch;
  onClose: () => void;
  onSave: (data: BranchFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BranchFormData>({
    name: branch?.name || "",
    address: branch?.address || "",
    city: branch?.city || "",
    phone: branch?.phone || "",
    email: branch?.email || "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {branch ? "Edit Branch" : "Add Branch"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <FormInput
            label="Branch Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Main Branch"
            required
          />
          <FormInput
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="123 Gym Street"
          />
          <FormInput
            label="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Mumbai"
          />
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
            <FormInput
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="branch@gym.com"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || saving}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : branch ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BranchesPage() {
  const { allowed, checked } = useRequirePermission("branches", "view", "deny");
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | undefined>();
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const router = useRouter();
  const { gymPath } = useGymSlug();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const createMutation = useMutation({
    mutationFn: (data: BranchFormData) => apiClient.post("/branches", data),
    onSuccess: () => {
      toast.success("Branch created successfully");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setShowForm(false);
    },
    onError: (err: Error) => {
      if (err.message?.includes("limit reached") || err.message?.includes("Upgrade")) {
        toast.error(err.message);
        router.push(gymPath("/settings/subscription"));
      } else {
        toast.error(err.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BranchFormData }) =>
      apiClient.patch(`/branches/${id}`, data),
    onSuccess: () => {
      toast.success("Branch updated successfully");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setShowForm(false);
      setEditingBranch(undefined);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/branches/${id}`),
    onSuccess: () => {
      toast.success("Branch and all linked data deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setDeletingBranch(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canCreate = hasPermission("branches", "create");
  const canEdit = hasPermission("branches", "edit");
  const canDelete = hasPermission("branches", "delete");

  const handleSave = (data: BranchFormData) => {
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns: ColumnDef<Branch>[] = [
    {
      header: "Branch",
      accessorKey: "name",
      cell: ({ row }) => {
        const branch = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{branch.name}</p>
              {branch.city && (
                <p className="text-xs text-muted-foreground">{branch.city}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Address",
      accessorKey: "address",
      cell: ({ row }) => {
        const branch = row.original;
        return branch.address ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            {branch.address}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
    },
    {
      header: "Contact",
      accessorKey: "phone",
      cell: ({ row }) => {
        const branch = row.original;
        return (
          <div className="text-sm space-y-0.5">
            {branch.phone && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                {branch.phone}
              </span>
            )}
            {branch.email && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                {branch.email}
              </span>
            )}
            {!branch.phone && !branch.email && (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Members",
      accessorKey: "_count",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          {row.original._count?.members ?? 0}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "is_active",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.is_active ? "active" : "inactive"}
        />
      ),
    },
    ...(canEdit || canDelete
      ? [
          {
            header: "Actions",
            id: "actions",
            cell: ({ row }: { row: { original: Branch } }) => {
              const branch = row.original;
              return (
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingBranch(branch);
                        setShowForm(true);
                      }}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                      title="Edit branch"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setDeletingBranch(branch)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete branch"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              );
            },
          } as ColumnDef<Branch>,
        ]
      : []),
  ];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="branches" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Branches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your studio locations
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setEditingBranch(undefined);
              setShowForm(true);
            }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <EmptyState
          title="No branches yet"
          description="Create your first branch to get started"
          icon={Building2}
        />
      ) : (
        <DataTable columns={columns} data={branches} />
      )}

      {showForm && (
        <BranchFormModal
          branch={editingBranch}
          onClose={() => {
            setShowForm(false);
            setEditingBranch(undefined);
          }}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Delete Branch</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete <strong className="text-foreground">{deletingBranch.name}</strong>?
                </p>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-5">
              <p className="text-sm text-red-400 font-medium mb-1">This action cannot be undone.</p>
              <p className="text-xs text-muted-foreground">
                All data linked to this branch will be permanently deleted including:
                members, check-ins, payments, classes, staff, and membership plans.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingBranch(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingBranch.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteMutation.isPending ? "Deleting..." : "Delete Branch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
