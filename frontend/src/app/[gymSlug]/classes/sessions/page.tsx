"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  AccessDenied,
  PageHeader,
  EmptyState,
  StatusBadge,
} from "@/components/shared";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import { useClassSessions } from "@/features/classes/hooks";

interface SessionRow {
  id: string;
  name?: string;
  template_name?: string;
  start_time?: string;
  end_time?: string;
  trainer_name?: string;
  status?: string;
  enrolled_count?: number;
  capacity?: number;
}

export default function ClassSessionsPage() {
  const { allowed, checked } = useRequirePermission("classes", "view", "deny");
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const [status, setStatus] = useState("");

  const { data, isLoading } = useClassSessions({
    branch_id: activeBranchId || undefined,
    status: status || undefined,
    limit: 100,
  });

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="classes" />
      </AppLayout>
    );
  }

  const sessions: SessionRow[] = Array.isArray(data)
    ? (data as SessionRow[])
    : ((data as { data?: SessionRow[] })?.data ?? []);

  const filters = [
    { label: "All", value: "" },
    { label: "Scheduled", value: "scheduled" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
    { label: "Cancelled", value: "cancelled" },
  ];

  return (
    <AppLayout>
      <Link
        href={gymPath("/schedule")}
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Schedule
      </Link>

      <PageHeader
        title="Class Sessions"
        description="Every scheduled instance of your class templates"
      />

      <div className="flex gap-2 mt-6 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              status === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={CalendarClock}
            title="No sessions found"
            description="When classes are scheduled, their sessions will appear here."
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas-soft">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Session</th>
                <th className="px-4 py-2.5 font-medium">Trainer</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Booked</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-border hover:bg-canvas-soft transition-colors cursor-pointer"
                  onClick={() => {
                    window.location.href = gymPath(`/classes/sessions/${s.id}`);
                  }}
                >
                  <td className="px-4 py-3 text-foreground font-medium">
                    {s.name ?? s.template_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.trainer_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.start_time
                      ? format(new Date(s.start_time), "dd MMM, HH:mm")
                      : "—"}
                    {s.end_time
                      ? ` – ${format(new Date(s.end_time), "HH:mm")}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {s.enrolled_count ?? 0}/{s.capacity ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status ?? "scheduled"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
