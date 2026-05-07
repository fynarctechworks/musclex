"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { FormInput } from "@/components/shared/form-fields";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Lock,
  Users,
} from "lucide-react";
import type { Role, PermissionModule, ModuleAction } from "@/lib/types";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { AccessDenied } from "@/components/shared";

const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Dashboard",
  members: "Members",
  check_ins: "Check-ins",
  payments: "Payments",
  classes: "Classes",
  staff: "Staff",
  marketing: "Marketing",
  ai: "AI Advisor",
  settings: "Settings",
  branches: "Branches",
  reports: "Reports",
};

const ALL_ACTIONS: ModuleAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
];

const ALL_MODULES: PermissionModule[] = Object.keys(
  MODULE_LABELS
) as PermissionModule[];

interface RolesResponse {
  system_roles: Role[];
  custom_roles: Role[];
}

function PermissionMatrix({
  permissions,
  onChange,
  readOnly,
}: {
  permissions: Record<string, string[]>;
  onChange?: (perms: Record<string, string[]>) => void;
  readOnly?: boolean;
}) {
  const toggle = (mod: string, action: string) => {
    if (readOnly || !onChange) return;
    const current = permissions[mod] || [];
    const updated = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    onChange({ ...permissions, [mod]: updated });
  };

  const toggleAll = (mod: string) => {
    if (readOnly || !onChange) return;
    const current = permissions[mod] || [];
    const updated =
      current.length === ALL_ACTIONS.length ? [] : [...ALL_ACTIONS];
    onChange({ ...permissions, [mod]: updated });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-3 text-muted-foreground font-medium">
              Module
            </th>
            {ALL_ACTIONS.map((action) => (
              <th
                key={action}
                className="text-center py-3 px-2 text-muted-foreground font-medium capitalize"
              >
                {action}
              </th>
            ))}
            {!readOnly && (
              <th className="text-center py-3 px-2 text-muted-foreground font-medium">
                All
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ALL_MODULES.map((mod) => {
            const modPerms = permissions[mod] || [];
            return (
              <tr key={mod} className="border-b border-border/50">
                <td className="py-2.5 px-3 text-foreground font-medium">
                  {MODULE_LABELS[mod]}
                </td>
                {ALL_ACTIONS.map((action) => {
                  const checked = modPerms.includes(action);
                  return (
                    <td key={action} className="text-center py-2.5 px-2">
                      <button
                        onClick={() => toggle(mod, action)}
                        disabled={readOnly}
                        className={`w-6 h-6 rounded border transition-colors flex items-center justify-center mx-auto ${
                          checked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        } ${readOnly ? "cursor-default opacity-70" : "cursor-pointer"}`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  );
                })}
                {!readOnly && (
                  <td className="text-center py-2.5 px-2">
                    <button
                      onClick={() => toggleAll(mod)}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      {modPerms.length === ALL_ACTIONS.length
                        ? "None"
                        : "All"}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoleFormModal({
  role,
  onClose,
  onSave,
  saving,
}: {
  role?: Role;
  onClose: () => void;
  onSave: (data: { name: string; description: string; permissions: Record<string, string[]> }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [permissions, setPermissions] = useState<Record<string, string[]>>(
    (role?.permissions as Record<string, string[]>) || {}
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {role ? "Edit Role" : "Create Custom Role"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <FormInput
            label="Role Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Receptionist, Lead Trainer"
            required
          />
          <FormInput
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this role's purpose"
          />
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-3">
          Permissions
        </h3>
        <div className="bg-background border border-border rounded-lg p-4">
          <PermissionMatrix
            permissions={permissions}
            onChange={setPermissions}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ name, description, permissions })}
            disabled={!name.trim() || saving}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : role ? "Update Role" : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleViewModal({
  role,
  onClose,
}: {
  role: Role;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {role.is_system && <Lock className="w-4 h-4 text-muted-foreground" />}
              {role.name}
            </h2>
            {role.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {role.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-background border border-border rounded-lg p-4">
          <PermissionMatrix
            permissions={role.permissions as Record<string, string[]>}
            readOnly
          />
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const { allowed, checked } = useRequirePermission("roles", "view", "deny");
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | undefined>();
  const [viewingRole, setViewingRole] = useState<Role | undefined>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const isOwner = user?.role === "owner";

  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<RolesResponse>("/roles"),
  });

  const createMutation = useMutation({
    mutationFn: (roleData: {
      name: string;
      description: string;
      permissions: Record<string, string[]>;
    }) => apiClient.post("/roles", roleData),
    onSuccess: () => {
      toast.success("Role created successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setShowForm(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data: roleData,
    }: {
      id: string;
      data: { name: string; description: string; permissions: Record<string, string[]> };
    }) => apiClient.patch(`/roles/${id}`, roleData),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setShowForm(false);
      setEditingRole(undefined);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = (roleData: {
    name: string;
    description: string;
    permissions: Record<string, string[]>;
  }) => {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: roleData });
    } else {
      createMutation.mutate(roleData);
    }
  };

  const systemRoles = data?.system_roles || [];
  const customRoles = data?.custom_roles || [];


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="roles" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6" /> Roles & Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage access control for your team
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              setEditingRole(undefined);
              setShowForm(true);
            }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Role
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Roles */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              System Roles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {systemRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setViewingRole(role)}
                  className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-medium text-foreground capitalize">
                        {role.name.replace("_", " ")}
                      </h3>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {role.staff_count}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {role.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(role.permissions || {})
                      .filter(
                        ([, actions]) =>
                          Array.isArray(actions) && actions.length > 0
                      )
                      .slice(0, 6)
                      .map(([mod]) => (
                        <span
                          key={mod}
                          className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                        >
                          {MODULE_LABELS[mod as PermissionModule] || mod}
                        </span>
                      ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Roles */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Custom Roles
            </h2>
            {customRoles.length === 0 ? (
              <EmptyState
                title="No custom roles"
                description="Create custom roles with specific permissions for your team"
                icon={Shield}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customRoles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">
                          {role.name}
                        </h3>
                        {role.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {role.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                          <Users className="w-3 h-3" />
                          {role.staff_count}
                        </span>
                        <button
                          onClick={() => setViewingRole(role)}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                          title="View permissions"
                        >
                          <Shield className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {isOwner && (
                          <>
                            <button
                              onClick={() => {
                                setEditingRole(role);
                                setShowForm(true);
                              }}
                              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                              title="Edit role"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete role "${role.name}"? This cannot be undone.`
                                  )
                                ) {
                                  deleteMutation.mutate(role.id);
                                }
                              }}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete role"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(role.permissions || {})
                        .filter(
                          ([, actions]) =>
                            Array.isArray(actions) && actions.length > 0
                        )
                        .map(([mod]) => (
                          <span
                            key={mod}
                            className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                          >
                            {MODULE_LABELS[mod as PermissionModule] || mod}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <RoleFormModal
          role={editingRole}
          onClose={() => {
            setShowForm(false);
            setEditingRole(undefined);
          }}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {viewingRole && (
        <RoleViewModal
          role={viewingRole}
          onClose={() => setViewingRole(undefined)}
        />
      )}
    </AppLayout>
  );
}
