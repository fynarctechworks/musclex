"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton, ConfirmDialog , AccessDenied } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Staff, Branch } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Mail, Phone, Star, Calendar, Send, Shield,
  Pencil, Trash2, Key, X, Save,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import {
  useSendInvite, useStaffPermissions, useUpdatePermissions,
  useUpdateStaff, useResetStaffPassword, useRevokeAllAccess,
} from "@/features/staff";
import { toast } from "sonner";
import { useRequirePermission } from "@/hooks/use-require-permission";

const PERMISSION_MODULES: Record<string, string[]> = {
  dashboard: ["view", "export"],
  members: ["view", "create", "edit", "delete", "export"],
  check_ins: ["view", "create", "edit", "delete", "export"],
  payments: ["view", "create", "edit", "delete", "export"],
  classes: ["view", "create", "edit", "delete", "export"],
  staff: ["view", "create", "edit", "delete", "export"],
  marketing: ["view", "create", "edit", "delete", "export"],
  ai: ["view", "create"],
  settings: ["view", "edit"],
  branches: ["view", "create", "edit", "delete"],
  organizations: ["view", "create", "edit", "delete"],
  reports: ["view", "export"],
  roles: ["view", "create", "edit", "delete"],
};

export default function StaffProfilePage() {
  const { allowed, checked } = useRequirePermission("staff", "view", "deny");
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isOwner = user?.role === "owner" || user?.role === "brand_owner";

  // Mutations
  const sendInviteMutation = useSendInvite();
  const updateStaffMutation = useUpdateStaff();
  const updatePermsMutation = useUpdatePermissions();
  const resetPasswordMutation = useResetStaffPassword();
  const revokeAccessMutation = useRevokeAllAccess();

  // UI state
  const [showPerms, setShowPerms] = useState(false);
  const [permGrants, setPermGrants] = useState<string[]>([]);
  const [permDenials, setPermDenials] = useState<string[]>([]);
  const [permsInitialized, setPermsInitialized] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAuthUser, setDeleteAuthUser] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "",
    specializations: "",
    employee_code: "",
    job_title: "",
    salary: "",
  });

  const { data: staff, isLoading } = useQuery<Staff>({
    queryKey: ["staff", id],
    queryFn: () => apiClient.get(`/staff/${id}`),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
  });

  const { data: permsData } = useStaffPermissions(showPerms ? id : "") as {
    data: { grants: string[]; denials: string[] } | undefined;
  };

  // Sync fetched permissions into local editable state
  useEffect(() => {
    if (permsData && !permsInitialized) {
      setPermGrants(permsData.grants || []);
      setPermDenials(permsData.denials || []);
      setPermsInitialized(true);
    }
  }, [permsData, permsInitialized]);

  function startEditing() {
    if (!staff) return;
    setEditForm({
      full_name: staff.full_name || "",
      email: staff.email || "",
      phone: staff.phone || "",
      role: staff.role || "",
      specializations: staff.specializations?.join(", ") || "",
      employee_code: (staff as any).employee_code || "",
      job_title: (staff as any).job_title || "",
      salary: staff.salary ? String(staff.salary) : "",
    });
    setIsEditing(true);
  }

  function handleSaveEdit() {
    const data: Record<string, unknown> = {};
    if (editForm.full_name !== staff?.full_name) data.full_name = editForm.full_name;
    if (editForm.email !== (staff?.email || "")) data.email = editForm.email || undefined;
    if (editForm.phone !== staff?.phone) data.phone = editForm.phone;
    if (editForm.role !== staff?.role) data.role = editForm.role;
    if (editForm.employee_code !== ((staff as any)?.employee_code || ""))
      data.employee_code = editForm.employee_code || undefined;
    if (editForm.job_title !== ((staff as any)?.job_title || ""))
      data.job_title = editForm.job_title || undefined;
    if (editForm.salary !== (staff?.salary ? String(staff.salary) : ""))
      data.salary = editForm.salary ? parseFloat(editForm.salary) : undefined;

    const newSpecs = editForm.specializations
      ? editForm.specializations.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const oldSpecs = staff?.specializations || [];
    if (JSON.stringify(newSpecs) !== JSON.stringify(oldSpecs))
      data.specializations = newSpecs;

    if (Object.keys(data).length === 0) {
      setIsEditing(false);
      return;
    }

    updateStaffMutation.mutate(
      { id, data },
      {
        onSuccess: () => {
          setIsEditing(false);
          qc.invalidateQueries({ queryKey: ["staff", id] });
        },
      },
    );
  }

  function handlePasswordReset() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    resetPasswordMutation.mutate(
      { staffId: id, password: newPassword },
      { onSuccess: () => { setNewPassword(""); setShowPasswordReset(false); } },
    );
  }

  function handleRevokeAccess() {
    revokeAccessMutation.mutate(
      { staffId: id, deleteAuthUser },
      {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          qc.invalidateQueries({ queryKey: ["staff", id] });
          router.push(gymPath("/staff"));
        },
      },
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingSkeleton className="h-96" />
      </AppLayout>
    );
  }

  if (!staff) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Staff member not found</p>
      </AppLayout>
    );
  }


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="staff" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/staff")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Staff
      </Link>

      {/* Profile Header */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            {isEditing ? (
              <input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="text-xl font-semibold text-foreground bg-background border border-border rounded-lg px-3 py-1 w-72"
              />
            ) : (
              <h1 className="text-xl font-semibold text-foreground">{staff.full_name}</h1>
            )}
            {isEditing ? (
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="mt-2 bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground"
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="trainer">Trainer</option>
                <option value="front_desk">Front Desk</option>
                <option value="regional_manager">Regional Manager</option>
                <option value="branch_manager">Branch Manager</option>
                <option value="accountant">Accountant</option>
                <option value="marketing_manager">Marketing Manager</option>
              </select>
            ) : (
              <span className="inline-block mt-1 px-2 py-0.5 bg-canvas-soft-2 text-primary text-xs rounded-full capitalize">
                {staff.role.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={staff.is_active ? "active" : "inactive"} />
            {isOwner && !isEditing && (
              <>
                <button
                  onClick={startEditing}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                  title="Revoke Access & Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={updateStaffMutation.isPending}
                  className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateStaffMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {isEditing ? (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Employee Code</label>
                <input
                  value={editForm.employee_code}
                  onChange={(e) => setEditForm({ ...editForm, employee_code: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Job Title</label>
                <input
                  value={editForm.job_title}
                  onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Salary</label>
                <input
                  type="number"
                  value={editForm.salary}
                  onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground w-full"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Specializations (comma-separated)</label>
                <input
                  value={editForm.specializations}
                  onChange={(e) => setEditForm({ ...editForm, specializations: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground w-full"
                  placeholder="e.g. Yoga, CrossFit, Weight Training"
                />
              </div>
            </>
          ) : (
            <>
              {staff.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {staff.phone}
                </div>
              )}
              {staff.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {staff.email}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="w-4 h-4 text-warning" />
                Performance: {staff.performance_score}/100
              </div>
              {staff.joined_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Joined {format(new Date(staff.joined_at), "MMM d, yyyy")}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Specializations (view mode only) */}
      {!isEditing && staff.specializations && staff.specializations.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-3">Specializations</h2>
          <div className="flex flex-wrap gap-2">
            {staff.specializations.map((spec) => (
              <span key={spec} className="px-3 py-1 bg-canvas-soft-2 text-primary text-sm rounded-full">
                {spec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Performance */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3">Performance Score</h2>
        <div className="w-full bg-background rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              staff.performance_score >= 70
                ? "bg-primary"
                : staff.performance_score >= 40
                  ? "bg-warning"
                  : "bg-destructive"
            }`}
            style={{ width: `${staff.performance_score}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">{staff.performance_score}/100</p>
      </div>

      {/* Owner Actions: Invite, Password, Permissions */}
      {isOwner && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Access Management</h2>

          {/* Send Invite */}
          {staff.email && !staff.user_id && (
            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
              <div>
                <p className="text-sm text-foreground">No login account linked</p>
                <p className="text-xs text-muted-foreground">Send an invite so this staff member can log in</p>
              </div>
              <button
                onClick={() =>
                  sendInviteMutation.mutate({
                    staffId: id,
                    data: { role_name: staff.role },
                  })
                }
                disabled={sendInviteMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendInviteMutation.isPending ? "Sending..." : "Send Invite"}
              </button>
            </div>
          )}

          {staff.user_id && (
            <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/30">
              <div className="w-2 h-2 bg-success rounded-full" />
              <p className="text-sm text-success">Login account linked</p>
            </div>
          )}

          {/* Password Reset */}
          {staff.user_id && (
            <div className="border border-border rounded-lg p-3">
              <button
                onClick={() => setShowPasswordReset(!showPasswordReset)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80"
              >
                <Key className="w-4 h-4" />
                {showPasswordReset ? "Hide Password Reset" : "Reset Password"}
              </button>
              {showPasswordReset && (
                <div className="mt-3 flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full focus:border-primary outline-none"
                    />
                  </div>
                  <button
                    onClick={handlePasswordReset}
                    disabled={resetPasswordMutation.isPending || newPassword.length < 8}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {resetPasswordMutation.isPending ? "Resetting..." : "Set Password"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Permissions */}
          <button
            onClick={() => {
              const next = !showPerms;
              setShowPerms(next);
              if (next && permsData && !permsInitialized) {
                setPermGrants(permsData.grants || []);
                setPermDenials(permsData.denials || []);
                setPermsInitialized(true);
              }
            }}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80"
          >
            <Shield className="w-4 h-4" />
            {showPerms ? "Hide Permissions" : "Manage Permission Overrides"}
          </button>

          {showPerms && (
            <div className="space-y-3">
              {/* Master controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const allCodes = Object.entries(PERMISSION_MODULES).flatMap(([mod, actions]) =>
                      actions.map((a) => `${mod}.${a}`)
                    );
                    setPermGrants(allCodes);
                    setPermDenials([]);
                  }}
                  className="px-3 py-1 bg-success/10 text-success text-xs rounded hover:bg-success/20"
                >
                  Grant All
                </button>
                <button
                  onClick={() => { setPermGrants([]); setPermDenials([]); }}
                  className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded hover:bg-canvas-soft-2"
                >
                  Clear All
                </button>
              </div>

              {/* Per-module permission picker */}
              {Object.entries(PERMISSION_MODULES).map(([module, actions]) => {
                const codes = actions.map((a) => `${module}.${a}`);
                const allGranted = codes.every((c) => permGrants.includes(c));
                const allDenied = codes.every((c) => permDenials.includes(c));

                return (
                  <div key={module} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground capitalize">{module.replace("_", " ")}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setPermDenials((d) => d.filter((c) => !codes.includes(c)));
                            setPermGrants((g) => Array.from(new Set([...g, ...codes])));
                          }}
                          className={`px-2 py-0.5 text-[10px] rounded ${allGranted ? "bg-success text-on-primary" : "bg-success/10 text-success hover:bg-success/20"}`}
                        >
                          +All
                        </button>
                        <button
                          onClick={() => {
                            setPermGrants((g) => g.filter((c) => !codes.includes(c)));
                            setPermDenials((d) => Array.from(new Set([...d, ...codes])));
                          }}
                          className={`px-2 py-0.5 text-[10px] rounded ${allDenied ? "bg-error text-on-primary" : "bg-error/10 text-error hover:bg-error/20"}`}
                        >
                          -All
                        </button>
                        <button
                          onClick={() => {
                            setPermGrants((g) => g.filter((c) => !codes.includes(c)));
                            setPermDenials((d) => d.filter((c) => !codes.includes(c)));
                          }}
                          className="px-2 py-0.5 text-[10px] rounded bg-muted text-muted-foreground hover:bg-canvas-soft-2"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {actions.map((action) => {
                        const code = `${module}.${action}`;
                        const isGranted = permGrants.includes(code);
                        const isDenied = permDenials.includes(code);

                        return (
                          <button
                            key={code}
                            onClick={() => {
                              if (isGranted) {
                                // granted -> denied
                                setPermGrants((g) => g.filter((c) => c !== code));
                                setPermDenials((d) => [...d, code]);
                              } else if (isDenied) {
                                // denied -> none
                                setPermDenials((d) => d.filter((c) => c !== code));
                              } else {
                                // none -> granted
                                setPermGrants((g) => [...g, code]);
                              }
                            }}
                            className={`px-2 py-1 text-[11px] rounded transition-colors ${
                              isGranted
                                ? "bg-success/20 text-success border border-success/30"
                                : isDenied
                                  ? "bg-error/20 text-error border border-error/30"
                                  : "bg-muted text-muted-foreground border border-border hover:border-primary/30"
                            }`}
                          >
                            {isGranted ? "+" : isDenied ? "-" : ""}{action}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Save button */}
              <button
                onClick={() => {
                  updatePermsMutation.mutate(
                    { staffId: id, data: { grants: permGrants, denials: permDenials } },
                    {
                      onSuccess: () => {
                        qc.invalidateQueries({ queryKey: ["staff-permissions", id] });
                      },
                    },
                  );
                }}
                disabled={updatePermsMutation.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {updatePermsMutation.isPending ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Revoke Access & Deactivate Staff"
        description={`This will remove all RBAC roles, permission overrides, revoke pending invites, unlink the login account, and deactivate ${staff.full_name}. This cannot be undone.`}
        confirmLabel="Revoke All Access"
        variant="danger"
        loading={revokeAccessMutation.isPending}
        onConfirm={handleRevokeAccess}
      />
    </AppLayout>
  );
}
