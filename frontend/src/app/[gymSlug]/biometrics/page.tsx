"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ScanFace,
  Fingerprint,
  Search,
  Trash2,
  CheckCircle2,
  Plus,
  Users,
  UserCog,
  ScrollText,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, EmptyState, AccessDenied } from "@/components/shared";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { biometricApi, ActivityLogDrawer } from "@/features/checkins";
import type {
  BiometricEnrollmentRow,
  BiometricProviderInfo,
} from "@/features/checkins";
import { membersApi } from "@/features/members/api";
import {
  staffApi,
  staffBiometricsApi,
  type StaffBiometricEnrollmentRow,
} from "@/features/staff/api";
import { EnrollBiometricDialog } from "../members/[id]/components/EnrollBiometricDialog";
import { EnrollStaffFaceDialog } from "./components/EnrollStaffFaceDialog";
import { useAuthStore } from "@/stores/auth-store";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { toast } from "sonner";

/**
 * Biometrics — central place to enroll and manage face/fingerprint identities.
 *
 * Members tab: list of enrolled members (active enrollments), search, enroll
 * any member, revoke an enrollment.
 *
 * Staff tab: scaffold + "Coming soon" — staff biometric attendance is a separate
 * pipeline (StaffAttendance) that doesn't share schema with member enrollments
 * yet. Surfaced now so the nav layout is right; wired up in a follow-up.
 */
export default function BiometricsPage() {
  const { allowed, checked } = useRequirePermission("members", "view", "deny");
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchId = activeBranchId || (user?.branch_ids?.[0] ?? "");
  const { gymPath } = useGymSlug();
  const [logOpen, setLogOpen] = useState(false);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Biometrics"
        description="Enroll and manage face & fingerprint identities for one-tap check-in."
        className="mb-6"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLogOpen(true)}
            className="gap-2"
          >
            <ScrollText className="h-3.5 w-3.5" />
            Activity Log
          </Button>
        }
      />

      <ActivityLogDrawer
        open={logOpen}
        onOpenChange={setLogOpen}
        branchId={branchId}
        historyHref={gymPath("/check-in/history")}
      />

      <ProviderStrip />

      <Tabs defaultValue="members" className="mt-6">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-3.5 w-3.5" />
            Members
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <UserCog className="h-3.5 w-3.5" />
            Staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MembersTab branchId={branchId} />
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <StaffTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

// ── Provider availability strip ─────────────────────────────────────────────
function ProviderStrip() {
  const { data } = useQuery({
    queryKey: ["biometric", "providers"],
    queryFn: () => biometricApi.listProviders(),
    staleTime: 5 * 60 * 1000,
  });

  const providers: BiometricProviderInfo[] = data?.providers ?? [];
  const face = providers.find((p) => p.modality === "face");
  const fingerprint = providers.find((p) => p.modality === "fingerprint");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ProviderCard
        icon={ScanFace}
        label="Face"
        sublabel={face?.label ?? "face-api.js (on-device)"}
        available={face?.available ?? true}
      />
      <ProviderCard
        icon={Fingerprint}
        label="Fingerprint"
        sublabel={fingerprint?.label ?? "ZKTeco / Mantra USB"}
        available={fingerprint?.available ?? false}
      />
    </div>
  );
}

function ProviderCard({
  icon: Icon,
  label,
  sublabel,
  available,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  available: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-card p-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-canvas-soft text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
      </div>
      {available ? (
        <Badge variant="outline" className="border-success/30 bg-success-soft text-success-deep text-[10px]">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Ready
        </Badge>
      ) : (
        <Badge variant="outline" className="border-hairline text-muted-foreground text-[10px]">
          Connect device
        </Badge>
      )}
    </div>
  );
}

// ── Members tab ─────────────────────────────────────────────────────────────
function MembersTab({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["biometric", "enrollments", "members"],
    queryFn: () => biometricApi.listAll({}),
  });

  const filtered = useMemo(() => {
    const rows = (enrollments ?? []).filter(
      (e) => e.member && !e.revoked_at,
    );
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (e) =>
        e.member?.full_name?.toLowerCase().includes(q) ||
        e.member?.member_code?.toLowerCase().includes(q),
    );
  }, [enrollments, query]);

  const revoke = useMutation({
    mutationFn: ({ id }: { id: string }) => biometricApi.revoke(id, branchId),
    onSuccess: () => {
      toast.success("Enrollment removed");
      queryClient.invalidateQueries({ queryKey: ["biometric", "enrollments"] });
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not remove enrollment"),
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or member code…"
            className="pl-8 h-9"
          />
        </div>
        <Button onClick={() => setPickerOpen(true)} size="sm" className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Enroll Member
        </Button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-hairline bg-card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ScanFace}
            title={query ? "No matching enrollments" : "No enrollments yet"}
            description={
              query
                ? "Try a different name or member code."
                : "Enroll a member's face to enable one-tap check-in."
            }
            action={
              !query ? (
                <Button size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Enroll a member
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-canvas-soft text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Member</th>
                <th className="text-left font-medium px-4 py-2.5">Modality</th>
                <th className="text-left font-medium px-4 py-2.5">Enrolled</th>
                <th className="text-right font-medium px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <EnrollmentRow
                  key={e.id}
                  row={e}
                  onRevoke={() => revoke.mutate({ id: e.id })}
                  isRevoking={revoke.isPending && revoke.variables?.id === e.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pick-a-member dialog → opens EnrollBiometricDialog */}
      <MemberPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(m) => {
          setPickerOpen(false);
          setSelectedMember({ id: m.id, name: m.full_name });
          setEnrollOpen(true);
        }}
      />

      {/* On-device face capture */}
      {selectedMember && (
        <EnrollBiometricDialog
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          branchId={branchId}
          open={enrollOpen}
          onClose={() => {
            setEnrollOpen(false);
            setSelectedMember(null);
            queryClient.invalidateQueries({
              queryKey: ["biometric", "enrollments"],
            });
          }}
        />
      )}
    </div>
  );
}

function EnrollmentRow({
  row,
  onRevoke,
  isRevoking,
}: {
  row: BiometricEnrollmentRow;
  onRevoke: () => void;
  isRevoking: boolean;
}) {
  const initials = (row.member?.full_name ?? "??")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <tr className="border-t border-hairline hover:bg-canvas-soft/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {row.member?.profile_photo_url ? (
              <AvatarImage src={row.member.profile_photo_url} />
            ) : null}
            <AvatarFallback className="bg-canvas-soft-2 text-foreground text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {row.member?.full_name ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {row.member?.member_code ?? ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-[13px] text-foreground capitalize">
          {row.modality === "face" ? (
            <ScanFace className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {row.modality}
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">
        {format(new Date(row.enrolled_at), "MMM d, yyyy")}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          variant="ghost"
          onClick={onRevoke}
          disabled={isRevoking}
          className="h-7 px-2 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ── Member picker ───────────────────────────────────────────────────────────
function MemberPickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (m: { id: string; full_name: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["members", "picker", search],
    queryFn: () =>
      membersApi.list({
        search: search || undefined,
        limit: 20,
        status: "active",
      }),
    enabled: open,
  });

  const members = data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pick a member to enroll</DialogTitle>
          <DialogDescription>
            Search by name or member code — only active members are shown.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            autoFocus
            className="pl-8"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto -mx-6 px-2">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Loading…
            </p>
          ) : members.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No members found.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {members.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() =>
                      onPick({ id: m.id, full_name: m.full_name })
                    }
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-canvas-soft transition-colors"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-canvas-soft-2 text-foreground text-[10px] font-semibold">
                        {(m.full_name ?? "??")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {m.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {m.member_code}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Staff tab ───────────────────────────────────────────────────────────────
// Enrolled staff drive the attendance (clock-in / clock-out) pipeline, distinct
// from member check-ins. A staff face match writes to staff_attendance, not
// check_ins — payroll and access control consume different signals.
function StaffTab() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["staff-biometric", "enrollments"],
    queryFn: () => staffBiometricsApi.listAll(),
  });

  const filtered = useMemo(() => {
    const rows = (enrollments ?? []).filter(
      (e) => e.staff && !e.revoked_at,
    );
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (e) =>
        e.staff?.full_name?.toLowerCase().includes(q) ||
        e.staff?.employee_code?.toLowerCase().includes(q),
    );
  }, [enrollments, query]);

  const revoke = useMutation({
    mutationFn: ({ id }: { id: string }) => staffBiometricsApi.revoke(id),
    onSuccess: () => {
      toast.success("Staff enrollment removed");
      queryClient.invalidateQueries({
        queryKey: ["staff-biometric", "enrollments"],
      });
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not remove enrollment"),
  });

  return (
    <div>
      <div className="rounded-md border border-link/30 bg-link-soft px-4 py-2.5 mb-4 text-xs text-link-deep">
        Staff face enrollment powers <span className="font-semibold">clock-in / clock-out</span> for
        attendance — separate from member check-ins.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or employee code…"
            className="pl-8 h-9"
          />
        </div>
        <Button onClick={() => setPickerOpen(true)} size="sm" className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Enroll Staff
        </Button>
      </div>

      <div className="rounded-lg border border-hairline bg-card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ScanFace}
            title={query ? "No matching enrollments" : "No staff enrolled yet"}
            description={
              query
                ? "Try a different name or employee code."
                : "Enroll a staff member's face to enable face-driven clock-in/out."
            }
            action={
              !query ? (
                <Button size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Enroll staff
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-canvas-soft text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Staff</th>
                <th className="text-left font-medium px-4 py-2.5">Role</th>
                <th className="text-left font-medium px-4 py-2.5">Modality</th>
                <th className="text-left font-medium px-4 py-2.5">Enrolled</th>
                <th className="text-right font-medium px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <StaffEnrollmentRow
                  key={e.id}
                  row={e}
                  onRevoke={() => revoke.mutate({ id: e.id })}
                  isRevoking={
                    revoke.isPending && revoke.variables?.id === e.id
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <StaffPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(s) => {
          setPickerOpen(false);
          setSelectedStaff({ id: s.id, name: s.full_name });
          setEnrollOpen(true);
        }}
      />

      {selectedStaff && (
        <EnrollStaffFaceDialog
          staffId={selectedStaff.id}
          staffName={selectedStaff.name}
          open={enrollOpen}
          onClose={() => {
            setEnrollOpen(false);
            setSelectedStaff(null);
            queryClient.invalidateQueries({
              queryKey: ["staff-biometric", "enrollments"],
            });
          }}
        />
      )}
    </div>
  );
}

function StaffEnrollmentRow({
  row,
  onRevoke,
  isRevoking,
}: {
  row: StaffBiometricEnrollmentRow;
  onRevoke: () => void;
  isRevoking: boolean;
}) {
  const initials = (row.staff?.full_name ?? "??")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <tr className="border-t border-hairline hover:bg-canvas-soft/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-canvas-soft-2 text-foreground text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {row.staff?.full_name ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {row.staff?.employee_code ?? ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-foreground capitalize">
        {row.staff?.job_title ?? row.staff?.role ?? "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-[13px] text-foreground capitalize">
          {row.modality === "face" ? (
            <ScanFace className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {row.modality}
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">
        {format(new Date(row.enrolled_at), "MMM d, yyyy")}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          variant="ghost"
          onClick={onRevoke}
          disabled={isRevoking}
          className="h-7 px-2 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function StaffPickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (s: { id: string; full_name: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["staff", "picker", search],
    queryFn: () =>
      staffApi.list({
        search: search || undefined,
        limit: 20,
        status: "active",
      }),
    enabled: open,
  });

  // staffApi.list returns either `{ data: [...] }` or a bare array depending on
  // endpoint. Normalize defensively.
  const staffList: Array<{
    id: string;
    full_name: string;
    employee_code?: string | null;
  }> = (data as { data?: unknown[] })?.data
    ? ((data as { data: unknown[] }).data as Array<{
        id: string;
        full_name: string;
        employee_code?: string | null;
      }>)
    : Array.isArray(data)
      ? (data as Array<{
          id: string;
          full_name: string;
          employee_code?: string | null;
        }>)
      : [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pick a staff member to enroll</DialogTitle>
          <DialogDescription>
            Search by name or employee code — only active staff are shown.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            autoFocus
            className="pl-8"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto -mx-6 px-2">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Loading…
            </p>
          ) : staffList.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No staff found.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {staffList.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() =>
                      onPick({ id: s.id, full_name: s.full_name })
                    }
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-canvas-soft transition-colors"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-canvas-soft-2 text-foreground text-[10px] font-semibold">
                        {(s.full_name ?? "??")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {s.employee_code ?? ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
