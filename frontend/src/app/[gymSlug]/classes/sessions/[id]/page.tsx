"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  Users,
  User,
  Building2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  AccessDenied,
  PageHeader,
  StatusBadge,
  EmptyState,
} from "@/components/shared";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useClassSession } from "@/features/classes/hooks";

interface SessionDetail {
  id: string;
  name?: string;
  template_name?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  trainer_name?: string;
  studio_name?: string;
  enrolled_count?: number;
  capacity?: number;
  notes?: string;
  bookings?: Array<{
    id: string;
    member_name?: string;
    member_code?: string;
    status?: string;
    booked_at?: string;
  }>;
}

export default function ClassSessionDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { allowed, checked } = useRequirePermission("classes", "view", "deny");
  const { gymPath } = useGymSlug();

  const { data, isLoading } = useClassSession(id);
  const session = data as SessionDetail | undefined;

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="classes" />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <TableSkeleton rows={6} />
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <Link
          href={gymPath("/classes/sessions")}
          className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sessions
        </Link>
        <EmptyState
          icon={CalendarClock}
          title="Session not found"
          description="This session may have been removed or never existed."
        />
      </AppLayout>
    );
  }

  const bookings = session.bookings ?? [];

  return (
    <AppLayout>
      <Link
        href={gymPath("/classes/sessions")}
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Sessions
      </Link>

      <PageHeader
        title={session.name ?? session.template_name ?? "Class Session"}
        description={
          session.start_time
            ? format(new Date(session.start_time), "EEEE, dd MMM yyyy · HH:mm")
            : undefined
        }
        actions={<StatusBadge status={session.status ?? "scheduled"} />}
      />

      {/* Meta cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Time
          </div>
          <p className="text-sm text-foreground font-medium">
            {session.start_time
              ? format(new Date(session.start_time), "HH:mm")
              : "—"}
            {session.end_time
              ? ` – ${format(new Date(session.end_time), "HH:mm")}`
              : ""}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1.5">
            <User className="h-3.5 w-3.5" /> Trainer
          </div>
          <p className="text-sm text-foreground font-medium">
            {session.trainer_name ?? "Unassigned"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1.5">
            <Building2 className="h-3.5 w-3.5" /> Studio
          </div>
          <p className="text-sm text-foreground font-medium">
            {session.studio_name ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1.5">
            <Users className="h-3.5 w-3.5" /> Booked
          </div>
          <p className="text-sm text-foreground font-medium">
            {session.enrolled_count ?? 0} / {session.capacity ?? 0}
          </p>
        </div>
      </div>

      {/* Roster */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Roster</h2>
        {bookings.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={Users}
              title="No bookings yet"
              description="When members book this session, they'll appear here."
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-canvas-soft">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Booking Status</th>
                  <th className="px-4 py-2.5 font-medium">Booked At</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-border hover:bg-canvas-soft transition-colors"
                  >
                    <td className="px-4 py-3 text-foreground">
                      {b.member_name ?? "—"}
                      {b.member_code && (
                        <span className="text-muted-foreground ml-1.5">
                          ({b.member_code})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status ?? "pending"} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.booked_at
                        ? format(new Date(b.booked_at), "dd MMM, HH:mm")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {session.notes && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Notes
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {session.notes}
          </p>
        </div>
      )}
    </AppLayout>
  );
}
