"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  isSameDay,
  parseISO,
} from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied, PageHeader } from "@/components/shared";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { useShifts, useCreateShift, useDeleteShift, useStaffList } from "@/features/staff";
import type { Branch } from "@/types";

interface ShiftRow {
  id: string;
  staff_id: string;
  branch_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  notes?: string | null;
  staff?: { id: string; full_name: string; employee_code?: string | null; role?: string } | null;
  branch?: { id: string; name: string } | null;
}

const SHIFT_TONE: Record<string, string> = {
  regular: "bg-canvas-soft-2 border-primary/30",
  overtime: "bg-warning/10 border-warning/40",
  split: "bg-muted border-border",
};

/**
 * Weekly staff shift schedule.
 *
 * The shifts API and hooks existed but no page imported them, so rostering
 * was unreachable — `/schedule` is the CLASS calendar, not staff shifts.
 */
export default function StaffShiftsPage() {
  const { allowed, checked } = useRequirePermission("staff", "view", "deny");
  const { gymPath } = useGymSlug();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission("staff", "edit");

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createFor, setCreateFor] = useState<Date | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShiftRow | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const { data, isLoading } = useShifts({
    branch_id: activeBranchId || undefined,
    start_date: format(weekStart, "yyyy-MM-dd"),
    end_date: format(weekEnd, "yyyy-MM-dd"),
  });

  const { data: staffList } = useStaffList({ limit: 200 });
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();

  const shifts = ((data as { data?: ShiftRow[] })?.data ?? (data as ShiftRow[]) ?? []) as ShiftRow[];
  const staffRows =
    ((staffList as { data?: Array<{ id: string; full_name: string }> })?.data ?? []) as Array<{
      id: string;
      full_name: string;
    }>;

  const shiftsFor = (day: Date) =>
    shifts.filter((s) => {
      try {
        return isSameDay(parseISO(s.shift_date), day);
      } catch {
        return false;
      }
    });

  const submit = (form: FormData) => {
    const branchId = String(form.get("branch_id") ?? "") || activeBranchId;
    if (!branchId) return;
    createShift.mutate(
      {
        staff_id: String(form.get("staff_id") ?? ""),
        branch_id: branchId,
        shift_date: String(form.get("shift_date") ?? ""),
        start_time: String(form.get("start_time") ?? ""),
        end_time: String(form.get("end_time") ?? ""),
        shift_type: String(form.get("shift_type") ?? "regular") as
          | "regular"
          | "overtime"
          | "split",
        notes: String(form.get("notes") ?? "") || undefined,
      },
      { onSuccess: () => setCreateFor(null) },
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
        title="Shift Schedule"
        description="Weekly staff roster"
        actions={
          canEdit ? (
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => setCreateFor(new Date())}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add shift
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center justify-between mt-6 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {format(weekStart, "dd MMM")} – {format(weekEnd, "dd MMM yyyy")}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          This week
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((day) => {
            const dayShifts = shiftsFor(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`rounded-lg border bg-card p-3 min-h-[160px] ${
                  isToday ? "border-primary/50" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                    <p
                      className={`text-sm font-semibold ${
                        isToday ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setCreateFor(day)}
                      title="Add shift"
                      className="p-1 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayShifts.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No shifts</p>
                  ) : (
                    dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded-md border px-2 py-1.5 ${
                          SHIFT_TONE[s.shift_type] ?? SHIFT_TONE.regular
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-foreground truncate">
                              {s.staff?.full_name ?? "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.start_time}–{s.end_time}
                            </p>
                            {s.shift_type !== "regular" && (
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {s.shift_type}
                              </p>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => setDeleteTarget(s)}
                              title="Remove shift"
                              className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shifts.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground text-center mt-6">
          <CalendarDays className="h-4 w-4 inline mr-1.5" />
          No shifts scheduled this week.
        </p>
      )}

      {/* Add shift */}
      <Dialog open={!!createFor} onOpenChange={(o) => !o && setCreateFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shift</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="staff_id">Staff member</Label>
              <select
                id="staff_id"
                name="staff_id"
                required
                className="w-full mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">Select…</option>
                {staffRows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="shift_date">Date</Label>
                <Input
                  id="shift_date"
                  name="shift_date"
                  type="date"
                  required
                  defaultValue={format(createFor ?? new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div>
                <Label htmlFor="shift_type">Type</Label>
                <select
                  id="shift_type"
                  name="shift_type"
                  className="w-full mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                >
                  <option value="regular">Regular</option>
                  <option value="overtime">Overtime</option>
                  <option value="split">Split</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start_time">Start</Label>
                <Input id="start_time" name="start_time" type="time" required defaultValue="09:00" />
              </div>
              <div>
                <Label htmlFor="end_time">End</Label>
                <Input id="end_time" name="end_time" type="time" required defaultValue="18:00" />
              </div>
            </div>

            {!activeBranchId && (
              <div>
                <Label htmlFor="branch_id">Branch</Label>
                <select
                  id="branch_id"
                  name="branch_id"
                  required
                  className="w-full mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                >
                  <option value="">Select…</option>
                  {(branches ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" placeholder="Cover, floor duty…" />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateFor(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                disabled={createShift.isPending}
              >
                Add shift
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove shift?"
        description={`${deleteTarget?.staff?.full_name ?? "This shift"} on ${
          deleteTarget ? format(parseISO(deleteTarget.shift_date), "dd MMM") : ""
        } will be removed from the roster.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) deleteShift.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </AppLayout>
  );
}
