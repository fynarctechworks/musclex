"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { FormInput, FormSelect , AccessDenied } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Branch } from "@/lib/types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, Mail, Shield, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useRequirePermission } from "@/hooks/use-require-permission";

// All permission modules and their actions (mirrors backend MODULES_ACTIONS)
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

const ROLE_OPTIONS = [
  { label: "Regional Manager", value: "regional_manager" },
  { label: "Branch Manager", value: "branch_manager" },
  { label: "Trainer", value: "trainer" },
  { label: "Front Desk", value: "front_desk" },
  { label: "Accountant", value: "accountant" },
  { label: "Marketing Manager", value: "marketing_manager" },
];

const EMPLOYMENT_OPTIONS = [
  { label: "Full Time", value: "full_time" },
  { label: "Part Time", value: "part_time" },
  { label: "Contract", value: "contract" },
  { label: "Freelance", value: "freelance" },
];

interface CreateStaffForm {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  employment_type: string;
  branch_ids: string[];
  specializations: string;
  job_title: string;
  salary: string;
}

export default function NewStaffPage() {
  const { allowed, checked } = useRequirePermission("staff", "create", "deny");
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const { register, handleSubmit, watch, control } = useForm<CreateStaffForm>({
    defaultValues: {
      role: "trainer",
      employment_type: "full_time",
    },
  });
  const [sendInvite, setSendInvite] = useState(true);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permGrants, setPermGrants] = useState<string[]>([]);
  const [permDenials, setPermDenials] = useState<string[]>([]);

  const emailValue = watch("email");
  const roleValue = watch("role");

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateStaffForm) =>
      apiClient.post("/staff", {
        full_name: data.full_name,
        email: data.email || undefined,
        phone: data.phone,
        role: data.role,
        branch_ids: data.branch_ids || [],
        job_title: data.job_title || undefined,
        employment_type: data.employment_type || "full_time",
        salary: data.salary ? parseFloat(data.salary) : undefined,
        specializations: data.specializations
          ? data.specializations.split(",").map((s) => s.trim())
          : [],
        send_invite: sendInvite && !!data.email,
        permission_grants: permGrants.length > 0 ? permGrants : undefined,
        permission_denials: permDenials.length > 0 ? permDenials : undefined,
      }),
    onSuccess: () => {
      toast.success(
        sendInvite && emailValue
          ? "Staff member added & invite sent"
          : "Staff member added"
      );
      router.push(gymPath("/staff"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function togglePermission(code: string, list: "grants" | "denials") {
    if (list === "grants") {
      setPermDenials((d) => d.filter((c) => c !== code));
      setPermGrants((g) =>
        g.includes(code) ? g.filter((c) => c !== code) : [...g, code]
      );
    } else {
      setPermGrants((g) => g.filter((c) => c !== code));
      setPermDenials((d) =>
        d.includes(code) ? d.filter((c) => c !== code) : [...d, code]
      );
    }
  }

  function grantAllModule(module: string) {
    const codes = PERMISSION_MODULES[module].map((a) => `${module}.${a}`);
    setPermDenials((d) => d.filter((c) => !codes.includes(c)));
    setPermGrants((g) => Array.from(new Set([...g, ...codes])));
  }

  function denyAllModule(module: string) {
    const codes = PERMISSION_MODULES[module].map((a) => `${module}.${a}`);
    setPermGrants((g) => g.filter((c) => !codes.includes(c)));
    setPermDenials((d) => Array.from(new Set([...d, ...codes])));
  }

  function clearModule(module: string) {
    const codes = PERMISSION_MODULES[module].map((a) => `${module}.${a}`);
    setPermGrants((g) => g.filter((c) => !codes.includes(c)));
    setPermDenials((d) => d.filter((c) => !codes.includes(c)));
  }

  function grantAllModules() {
    const all = Object.entries(PERMISSION_MODULES).flatMap(([m, actions]) =>
      actions.map((a) => `${m}.${a}`)
    );
    setPermDenials([]);
    setPermGrants(all);
  }

  function clearAll() {
    setPermGrants([]);
    setPermDenials([]);
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
      <div className="max-w-2xl">
        <Link
          href={gymPath("/staff")}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Staff
        </Link>
        <h1 className="text-xl font-semibold text-foreground mb-6">
          Add Staff Member
        </h1>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          {/* Basic Info */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <FormInput
              label="Full Name"
              {...register("full_name", { required: "Name is required" })}
              placeholder="John Doe"
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
                {...register("phone", { required: "Phone is required" })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="role"
                control={control}
                rules={{ required: "Role is required" }}
                render={({ field }) => (
                  <FormSelect
                    label="Role"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={ROLE_OPTIONS}
                  />
                )}
              />
              <Controller
                name="employment_type"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Employment Type"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={EMPLOYMENT_OPTIONS}
                  />
                )}
              />
            </div>

            <FormInput
              label="Job Title"
              {...register("job_title")}
              placeholder="Senior Trainer"
            />
            <p className="text-xs text-muted-foreground -mt-2">
              Employee code is auto-generated on save (format:
              EMP-{"<gym>"}-0001).
            </p>

            <FormInput
              label="Salary"
              type="number"
              {...register("salary")}
              placeholder="0.00"
            />

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Branches
              </label>
              <div className="space-y-2">
                {branches?.map((branch) => (
                  <label key={branch.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={branch.id}
                      {...register("branch_ids")}
                      className="rounded border-border bg-background text-primary"
                    />
                    <span className="text-sm text-foreground">
                      {branch.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <FormInput
              label="Specializations"
              {...register("specializations")}
              placeholder="Yoga, HIIT, Strength Training (comma-separated)"
            />
          </div>

          {/* Invite Section */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Send Login Invite
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSendInvite(!sendInvite)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  sendInvite ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-canvas transition-transform ${
                    sendInvite ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {sendInvite && (
              <p className="text-xs text-muted-foreground">
                An email invite will be sent to the staff member. They can set
                their password and log in to manage their assigned areas.
                {!emailValue && (
                  <span className="text-warning ml-1">
                    (Enter an email above to enable invite)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Permission Overrides */}
          <div className="bg-card border border-border rounded-lg p-6">
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Custom Permission Overrides
                </span>
                {(permGrants.length > 0 || permDenials.length > 0) && (
                  <span className="text-xs bg-canvas-soft-2 text-primary px-2 py-0.5 rounded-full">
                    {permGrants.length} grants, {permDenials.length} denials
                  </span>
                )}
              </div>
              {showPermissions ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showPermissions && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Override the default role permissions. Grants add permissions
                  beyond the role, denials remove them.
                  {roleValue && (
                    <span className="ml-1">
                      Base role:{" "}
                      <strong className="text-foreground capitalize">
                        {roleValue.replace(/_/g, " ")}
                      </strong>
                    </span>
                  )}
                </p>

                {/* Quick actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={grantAllModules}
                    className="px-3 py-1 text-xs rounded bg-success/10 text-success border border-success/30 hover:bg-success/20 transition-colors"
                  >
                    Grant All
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-1 text-xs rounded bg-muted text-muted-foreground border border-border hover:bg-background transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2">
                  {Object.entries(PERMISSION_MODULES).map(
                    ([module, actions]) => {
                      const moduleCodes = actions.map((a) => `${module}.${a}`);
                      const allGranted = moduleCodes.every((c) => permGrants.includes(c));
                      const allDenied = moduleCodes.every((c) => permDenials.includes(c));
                      return (
                        <div
                          key={module}
                          className="border border-border rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-foreground uppercase">
                              {module.replace(/_/g, " ")}
                            </h4>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => grantAllModule(module)}
                                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                                  allGranted
                                    ? "bg-success/20 text-success"
                                    : "text-muted-foreground hover:text-success"
                                }`}
                                title="Grant all in this module"
                              >
                                +All
                              </button>
                              <button
                                type="button"
                                onClick={() => denyAllModule(module)}
                                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                                  allDenied
                                    ? "bg-error/20 text-error"
                                    : "text-muted-foreground hover:text-error"
                                }`}
                                title="Deny all in this module"
                              >
                                -All
                              </button>
                              <button
                                type="button"
                                onClick={() => clearModule(module)}
                                className="px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground rounded transition-colors"
                                title="Clear overrides for this module"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {actions.map((action) => {
                              const code = `${module}.${action}`;
                              const isGrant = permGrants.includes(code);
                              const isDenial = permDenials.includes(code);
                              return (
                                <div key={code} className="flex items-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      togglePermission(code, "grants")
                                    }
                                    className={`px-2 py-1 text-xs rounded-l border transition-colors ${
                                      isGrant
                                        ? "bg-success/20 text-success border-success/30"
                                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                                    }`}
                                    title={`Grant ${code}`}
                                  >
                                    +{action}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      togglePermission(code, "denials")
                                    }
                                    className={`px-2 py-1 text-xs rounded-r border-t border-b border-r transition-colors ${
                                      isDenial
                                        ? "bg-error/20 text-error border-error/30"
                                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                                    }`}
                                    title={`Deny ${code}`}
                                  >
                                    -{action}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending
                ? "Adding..."
                : sendInvite && emailValue
                  ? "Add & Send Invite"
                  : "Add Staff"}
            </button>
            <Link
              href={gymPath("/staff")}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
