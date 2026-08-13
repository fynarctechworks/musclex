'use client';

import React, { useState } from 'react';
import { ClipboardList, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  useCancelDietAssignment,
  useCancelWorkoutAssignment,
  useDietAssignments,
  useWorkoutAssignments,
} from '../hooks';
import { difficultyLabels, workoutGoalLabels } from '../types';

const RECENT_LIMIT = 15;

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
      </div>
      <div className="overflow-hidden rounded-lg border border-hairline bg-card shadow-level-1">
        {children}
      </div>
    </section>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-20 text-center text-muted-foreground"
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

// ── Workout assignments ─────────────────────────────────────────

export function WorkoutAssignmentsSection() {
  const { data, isLoading } = useWorkoutAssignments({ limit: RECENT_LIMIT });
  const cancelMutation = useCancelWorkoutAssignment();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const rows = data?.data ?? [];

  return (
    <SectionShell title="Recent Workout Assignments">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-canvas-soft">
            <TableHead>Member</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <EmptyRow colSpan={5} label="Loading assignments..." />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={5} label="No workout assignments yet." />
          ) : (
            rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">
                      {a.member?.full_name ?? '—'}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {a.member?.member_code ?? ''}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-foreground">
                      {a.workout_plan?.title ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        a.workout_plan?.goal
                          ? workoutGoalLabels[a.workout_plan.goal]
                          : null,
                        a.workout_plan?.difficulty
                          ? difficultyLabels[a.workout_plan.difficulty]
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(a.scheduled_date)}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    variant={
                      a.status === 'completed'
                        ? 'active'
                        : a.status === 'skipped'
                          ? 'expired'
                          : 'pending'
                    }
                    label={
                      a.status.charAt(0).toUpperCase() + a.status.slice(1)
                    }
                  />
                </TableCell>
                <TableCell>
                  {a.status === 'assigned' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setCancelId(a.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Cancel assignment"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel Workout Assignment"
        description="Remove this scheduled workout from the member's calendar? This cannot be undone."
        confirmLabel="Cancel Assignment"
        variant="danger"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (cancelId) {
            cancelMutation.mutate(cancelId, {
              onSettled: () => setCancelId(null),
            });
          }
        }}
      />
    </SectionShell>
  );
}

// ── Diet assignments ────────────────────────────────────────────

export function DietAssignmentsSection() {
  const { data, isLoading } = useDietAssignments({ limit: RECENT_LIMIT });
  const cancelMutation = useCancelDietAssignment();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const rows = data?.data ?? [];

  return (
    <SectionShell title="Recent Diet Assignments">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-canvas-soft">
            <TableHead>Member</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Starts</TableHead>
            <TableHead>Ends</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <EmptyRow colSpan={6} label="Loading assignments..." />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={6} label="No diet assignments yet." />
          ) : (
            rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">
                      {a.member?.full_name ?? '—'}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {a.member?.member_code ?? ''}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  {a.diet_plan?.title ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(a.starts_on)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(a.ends_on)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={a.status} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCancelId(a.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Cancel assignment"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel Diet Assignment"
        description="Cancel this member's diet plan assignment? The member will no longer see this plan."
        confirmLabel="Cancel Assignment"
        variant="danger"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (cancelId) {
            cancelMutation.mutate(cancelId, {
              onSettled: () => setCancelId(null),
            });
          }
        }}
      />
    </SectionShell>
  );
}
