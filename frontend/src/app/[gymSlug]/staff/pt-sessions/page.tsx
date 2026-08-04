"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, CheckCircle2, XCircle, UserX, Dumbbell } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied, PageHeader, EmptyState, StatusBadge } from "@/components/shared";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api";
import {
  useTrainerSessions,
  useCreateTrainerSession,
  useUpdateTrainerSession,
  useStaffList,
} from "@/features/staff";
import type { Member, PaginatedResponse } from "@/lib/types";

interface SessionRow {
  id: string;
  session_date: string;
  session_duration: number;
  session_type: string;
  status: string;
  notes?: string | null;
  trainer?: { id: string; full_name: string } | null;
  member?: { id: string; full_name: string } | null;
  branch?: { id: string; name: string } | null;
  revenue?: { revenue_amount: string | number; commission_amount: string | number } | null;
}

const TYPE_LABEL: Record<string, string> = {
  personal_training: "Personal training",
  group_training: "Group training",
  rehab_session: "Rehab",
  assessment: "Assessment",
};

const STATUS_TONE: Record<string, string> = {
  completed: "active",
  scheduled: "pending",
  cancelled: "expired",
  no_show: "expired",
};

/**
 * Personal-training session log.
 *
 * `TrainerSession` CRUD (with scheduling-conflict detection and automatic
 * commission accrual on completion) has been complete on the backend, and the
 * hooks existed — but no screen logged a session, so PT delivery was invisible
 * and commissions never accrued in practice.
 */
export default function PtSessionsPage() {
  const { allowed, checked } = useRequirePermission("staff", "view", "deny");
  const { gymPath } = useGymSlug();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission("staff", "edit");

  const [status, setStatus] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [notesFor, setNotesFor] = useState<SessionRow | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [pickedMember, setPickedMember] = useState<{ id: string; full_name: string } | null>(null);

  const { data, isLoading } = useTrainerSessions({
    status: status || undefined,
    trainer_id: trainerFilter || undefined,
    branch_id: activeBranchId || undefined,
    limit: 100,
  });

  const { data: staffList } = useStaffList({ limit: 200, role: "trainer" });
  const { data: memberResults } = useQuery({
    queryKey: ["member-search-pt", memberSearch],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Member>>(`/members?search=${memberSearch}&limit=5`),
    enabled: memberSearch.length >= 2,
  });

  const createSession = useCreateTrainerSession();
  const updateSession = useUpdateTrainerSession();

  const sessions = ((data as { data?: SessionRow[] })?.data ?? []) as SessionRow[];
  const trainers = ((staffList as { data?: Array<{ id: string; full_name: string }> })?.data ??
    []) as Array<{ id: string; full_name: string }>;

  const submit = (form: FormData) => {
    if (!pickedMember || !activeBranchId) return;
    createSession.mutate(
      {
        trainer_id: String(form.get("trainer_id") ?? ""),
        member_id: pickedMember.id,
        branch_id: activeBranchId,
        session_date: new Date(String(form.get("session_date") ?? "")).toISOString(),
        session_duration: Number(form.get("session_duration") ?? 60),
        session_type: String(form.get("session_type") ?? "personal_training") as
          | "personal_training"
          | "group_training"
          | "rehab_session"
          | "assessment",
        notes: String(form.get("notes") ?? "") || undefined,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setPickedMember(null);
          setMemberSearch("");
        },
      },
    );
  };

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
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Staff
      </Link>

      <PageHeader
        title="PT Sessions"
        description="Log personal-training delivery — completing a session accrues trainer commission"
        actions={
          canEdit ? (
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => setCreateOpen(true)}
              disabled={!activeBranchId}
              title={!activeBranchId ? "Select a branch first" : undefined}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Log session
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mt-6 mb-4">
        <select
          value={trainerFilter}
          onChange={(e) => setTrainerFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground sm:w-[200px]"
        >
          <option value="">All trainers</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {["", "scheduled", "completed", "cancelled", "no_show"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s ? s.replace("_", " ") : "All"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={Dumbbell}
            title="No PT sessions"
            description="Log a session when a trainer delivers personal training. Completing it books the trainer's commission."
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas-soft">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Trainer</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium text-right">Duration</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                {canEdit && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-canvas-soft">
                  <td className="px-4 py-3 text-foreground">
                    {format(new Date(s.session_date), "dd MMM yyyy, HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-foreground">{s.member?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.trainer?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {TYPE_LABEL[s.session_type] ?? s.session_type}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {s.session_duration} min
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={STATUS_TONE[s.status] ?? "pending"} />
                    {s.status === "no_show" && (
                      <span className="text-[11px] text-muted-foreground ml-1.5">no-show</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setNotesFor(s)}
                          title="Session notes"
                          className="p-1.5 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground text-[11px] px-2"
                        >
                          Notes
                        </button>
                        {s.status === "scheduled" && (
                          <>
                            <button
                              onClick={() =>
                                updateSession.mutate({ id: s.id, data: { status: "completed" } })
                              }
                              title="Mark complete (accrues commission)"
                              className="p-1.5 rounded hover:bg-canvas-soft-2 text-success"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                updateSession.mutate({ id: s.id, data: { status: "no_show" } })
                              }
                              title="Member no-show"
                              className="p-1.5 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-warning"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                updateSession.mutate({ id: s.id, data: { status: "cancelled" } })
                              }
                              title="Cancel session"
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log session */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log PT session</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="trainer_id">Trainer</Label>
              <select
                id="trainer_id"
                name="trainer_id"
                required
                className="w-full mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">Select…</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="member-search">Member</Label>
              {pickedMember ? (
                <div className="mt-1 flex items-center gap-2 rounded-md bg-canvas-soft-2 border border-primary/20 px-3 py-2">
                  <span className="text-sm text-primary font-medium">
                    {pickedMember.full_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickedMember(null)}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    id="member-search"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by name or phone…"
                  />
                  {memberResults?.data?.length ? (
                    <div className="mt-1 rounded-md border border-border overflow-hidden">
                      {memberResults.data.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            setPickedMember({ id: m.id, full_name: m.full_name });
                            setMemberSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm text-foreground border-b border-border last:border-0"
                        >
                          {m.full_name}{" "}
                          <span className="text-muted-foreground">({m.member_code})</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="session_date">Date &amp; time</Label>
                <Input
                  id="session_date"
                  name="session_date"
                  type="datetime-local"
                  required
                  defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>
              <div>
                <Label htmlFor="session_duration">Duration (min)</Label>
                <Input
                  id="session_duration"
                  name="session_duration"
                  type="number"
                  min={15}
                  step={5}
                  defaultValue={60}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="session_type">Type</Label>
              <select
                id="session_type"
                name="session_type"
                className="w-full mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                {Object.entries(TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" placeholder="Focus, cues, progression…" />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                disabled={!pickedMember || createSession.isPending}
              >
                {createSession.isPending ? "Saving…" : "Log session"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Notes */}
      <Dialog open={!!notesFor} onOpenChange={(o) => !o && setNotesFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session notes — {notesFor?.member?.full_name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (notesFor) {
                updateSession.mutate(
                  { id: notesFor.id, data: { notes: String(form.get("notes") ?? "") } },
                  { onSuccess: () => setNotesFor(null) },
                );
              }
            }}
            className="space-y-4"
          >
            <Textarea
              name="notes"
              defaultValue={notesFor?.notes ?? ""}
              rows={6}
              placeholder="What was covered, how the member performed, next session plan…"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNotesFor(null)}>
                Close
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground">
                Save notes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
