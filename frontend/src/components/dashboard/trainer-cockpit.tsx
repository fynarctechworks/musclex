"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  Users,
  UserMinus,
  AlertTriangle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  PageHeader,
  AccessDenied,
  LoadingSkeleton,
  EmptyState,
} from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/services/query-client";
import { PulseCard } from "./pulse-card";
import { FreshnessPill } from "./freshness-pill";
import { ActionStack } from "./action-stack";
import type { ActionItem } from "./action-stack";
import { AdvisorDrawer } from "./advisor-drawer";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useActions } from "@/hooks/use-actions";

interface SessionLite {
  id: string;
  name: string;
  start_time: string;
  end_time?: string;
  capacity: number;
  enrolled_count: number;
  status?: string;
}

interface CockpitPayload {
  staff_id: string | null;
  sessions_today: SessionLite[];
  next_session: SessionLite | null;
  sessions_today_count: number;
  clients_count: number;
  attendance_rate_30d: number | null;
  retention_rate_60d: number | null;
  no_shows_30d: number;
  upcoming_sessions: SessionLite[];
  my_clients_at_risk: number;
}

/**
 * Trainer Cockpit (§3.5 of the World #1 Dashboard plan).
 *
 * Personal performance only — *my* sessions, *my* clients, *my* attendance,
 * *my* retention. No financials, no chain-level data. Action Stack is
 * already trainer-filtered server-side.
 */
export function TrainerCockpit() {
  const { gymPath } = useGymSlug();
  const { activeBranchId, user } = useAuthStore();
  const { allowed, checked } = useRequirePermission("dashboard", "view", "deny");
  const branchId = activeBranchId || undefined;

  const { data: cockpit, isLoading, dataUpdatedAt } = useQuery<CockpitPayload>({
    queryKey: ["dashboard", "trainer-cockpit"],
    queryFn: () => apiClient.get("/dashboard/trainer-cockpit"),
    refetchInterval: 60_000,
  });

  const {
    actions: serverActions,
    isLoading: actionsLoading,
    dismiss,
    snooze,
    resolve,
  } = useActions({ branchId });

  const actions = useMemo<ActionItem[]>(
    () =>
      serverActions.map((a) => ({
        ...a,
        cta_href: a.cta_href ? gymPath(a.cta_href) : undefined,
        on_dismiss: dismiss,
        on_snooze: snooze,
        on_resolve: resolve,
      })),
    [serverActions, dismiss, snooze, resolve, gymPath],
  );

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="dashboard" />
      </AppLayout>
    );
  }

  if (!isLoading && cockpit && !cockpit.staff_id) {
    return (
      <AppLayout>
        <PageHeader title="Trainer Cockpit" className="mb-6" />
        <EmptyState
          icon={Dumbbell}
          title="Your trainer profile isn't linked yet"
          description="Ask an owner to link your account to a Staff record so we can show your sessions, clients, and attendance."
        />
      </AppLayout>
    );
  }

  const asOf = cockpit ? new Date(dataUpdatedAt).toISOString() : undefined;

  return (
    <AppLayout>
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}`}
        description="Your sessions, your clients, your numbers."
        actions={<FreshnessPill asOf={asOf} />}
        className="mb-6"
      />

      {/* Personal pulse */}
      {isLoading || !cockpit ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <PulseCard
            label="Sessions Today"
            value={cockpit.sessions_today_count.toString()}
            icon={CalendarClock}
            subtitle={
              cockpit.next_session
                ? `Next: ${cockpit.next_session.name} at ${formatTime(cockpit.next_session.start_time)}`
                : cockpit.sessions_today_count === 0
                  ? "Nothing scheduled — enjoy the day"
                  : "All sessions complete"
            }
            asOf={asOf}
          />
          <PulseCard
            label="My Clients"
            value={cockpit.clients_count.toLocaleString()}
            icon={Users}
            subtitle="Members who attended your last 60 days"
            asOf={asOf}
            href={gymPath("/members")}
          />
          <PulseCard
            label="Attendance Rate"
            value={
              cockpit.attendance_rate_30d !== null
                ? `${cockpit.attendance_rate_30d}%`
                : "—"
            }
            icon={CheckCircle2}
            subtitle="present / scheduled · last 30 days"
            asOf={asOf}
          />
          <PulseCard
            label="Clients at Risk"
            value={cockpit.my_clients_at_risk.toString()}
            icon={AlertTriangle}
            positiveIs="bad"
            subtitle="Memberships expiring in next 7 days"
            asOf={asOf}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's roster */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              Today's Sessions
            </h2>
            {cockpit && (
              <span className="text-[12px] text-muted-foreground">
                {cockpit.no_shows_30d} no-show
                {cockpit.no_shows_30d === 1 ? "" : "s"} (30d)
              </span>
            )}
          </div>
          {isLoading || !cockpit ? (
            <LoadingSkeleton className="h-40" />
          ) : cockpit.sessions_today.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-background/20 p-6 text-center">
              <p className="text-[13px] text-foreground">Nothing on your schedule today.</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Use the time to check in with at-risk clients.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cockpit.sessions_today.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-background/40 border border-border/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {formatTime(s.start_time)}
                      {s.end_time ? ` – ${formatTime(s.end_time)}` : ""} ·
                      {" "}
                      {s.enrolled_count}/{s.capacity} booked
                    </p>
                  </div>
                  <a
                    href={gymPath(`/classes/sessions/${s.id}`)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Personal action stack */}
        <div className="lg:col-span-1">
          <ActionStack items={actions} loading={actionsLoading} />
        </div>
      </div>

      {/* Upcoming */}
      {cockpit && cockpit.upcoming_sessions.length > 0 && (
        <div className="mt-6 bg-card border border-border rounded-lg p-5">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Coming Up
          </h2>
          <ul className="space-y-2">
            {cockpit.upcoming_sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-background/30 border border-border/30"
              >
                <span className="text-[13px] text-foreground">{s.name}</span>
                <span className="text-[12px] text-muted-foreground">
                  {formatDateTime(s.start_time)} · {s.enrolled_count}/{s.capacity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdvisorDrawer
        context={{
          screen: "trainer_cockpit",
          branch_id: branchId ?? null,
          role: "trainer",
        }}
      />

      {cockpit && cockpit.no_shows_30d >= 3 && (
        <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 flex items-start gap-3">
          <UserMinus className="w-5 h-5 text-warning mt-0.5" />
          <div>
            <p className="text-[14px] font-medium text-foreground">
              {cockpit.no_shows_30d} no-shows in the last 30 days
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Consider reaching out — engaged trainers retain clients longer.
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(ts: string): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
