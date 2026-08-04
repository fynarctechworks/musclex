"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { Dumbbell, Plus, Salad, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWorkoutPlans,
  useDietPlans,
  useDeactivateWorkoutPlan,
  useDeactivateDietPlan,
  WorkoutPlanTable,
  DietPlanTable,
  WorkoutPlanFormDialog,
  DietPlanFormDialog,
  AssignWorkoutPlanDialog,
  AssignDietPlanDialog,
  WorkoutAssignmentsSection,
  DietAssignmentsSection,
} from "@/features/plans";
import type { DietPlan, WorkoutPlan } from "@/features/plans";

const PAGE_LIMIT = 100;

export default function TrainingPlansPage() {
  const { allowed, checked } = useRequirePermission("members", "view", "deny");
  const { gymPath } = useGymSlug();

  const [tab, setTab] = useState("workout");

  // ── Workout tab state ─────────────────────────────────────
  const [workoutSearch, setWorkoutSearch] = useState("");
  const [workoutStatus, setWorkoutStatus] = useState("all");
  const [workoutFormOpen, setWorkoutFormOpen] = useState(false);
  const [editWorkoutPlan, setEditWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [assignWorkoutPlan, setAssignWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [deactivateWorkout, setDeactivateWorkout] = useState<WorkoutPlan | null>(null);

  const { data: workoutData, isLoading: workoutLoading } = useWorkoutPlans({
    search: workoutSearch || undefined,
    is_active: workoutStatus !== "all" ? workoutStatus === "true" : undefined,
    limit: PAGE_LIMIT,
  });
  const deactivateWorkoutMutation = useDeactivateWorkoutPlan();

  // ── Diet tab state ────────────────────────────────────────
  const [dietSearch, setDietSearch] = useState("");
  const [dietStatus, setDietStatus] = useState("all");
  const [dietFormOpen, setDietFormOpen] = useState(false);
  const [editDietPlan, setEditDietPlan] = useState<DietPlan | null>(null);
  const [assignDietPlan, setAssignDietPlan] = useState<DietPlan | null>(null);
  const [deactivateDiet, setDeactivateDiet] = useState<DietPlan | null>(null);

  const { data: dietData, isLoading: dietLoading } = useDietPlans({
    search: dietSearch || undefined,
    is_active: dietStatus !== "all" ? dietStatus === "true" : undefined,
    limit: PAGE_LIMIT,
  });
  const deactivateDietMutation = useDeactivateDietPlan();

  const workoutPlans = workoutData?.data ?? [];
  const dietPlans = dietData?.data ?? [];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Training"
          title="Training Plans"
          description="Build workout and diet plans, then assign them to members."
          actions={
            tab === "workout" ? (
              <div className="flex gap-2">
                <Link href={gymPath("/training/exercises")}>
                  <Button variant="outline">Exercise Library</Button>
                </Link>
                <Button
                  onClick={() => {
                    setEditWorkoutPlan(null);
                    setWorkoutFormOpen(true);
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="mr-2 h-4 w-4" /> New Workout Plan
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setEditDietPlan(null);
                  setDietFormOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" /> New Diet Plan
              </Button>
            )
          }
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="workout">
              <Dumbbell className="mr-1.5 h-4 w-4" /> Workout Plans
            </TabsTrigger>
            <TabsTrigger value="diet">
              <Salad className="mr-1.5 h-4 w-4" /> Diet Plans
            </TabsTrigger>
          </TabsList>

          {/* ── Workout plans ─────────────────────────────── */}
          <TabsContent value="workout" className="space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search workout plans..."
                  value={workoutSearch}
                  onChange={(e) => setWorkoutSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={workoutStatus} onValueChange={setWorkoutStatus}>
                <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {workoutLoading ? (
              <TableSkeleton rows={6} />
            ) : workoutPlans.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="No workout plans found"
                description="Create your first workout plan to start assigning training to members."
                action={
                  <Button
                    onClick={() => {
                      setEditWorkoutPlan(null);
                      setWorkoutFormOpen(true);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4" /> New Workout Plan
                  </Button>
                }
              />
            ) : (
              <WorkoutPlanTable
                plans={workoutPlans}
                onEdit={(plan) => {
                  setEditWorkoutPlan(plan);
                  setWorkoutFormOpen(true);
                }}
                onAssign={(plan) => setAssignWorkoutPlan(plan)}
                onDeactivate={(plan) => setDeactivateWorkout(plan)}
              />
            )}

            <WorkoutAssignmentsSection />
          </TabsContent>

          {/* ── Diet plans ────────────────────────────────── */}
          <TabsContent value="diet" className="space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search diet plans..."
                  value={dietSearch}
                  onChange={(e) => setDietSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={dietStatus} onValueChange={setDietStatus}>
                <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dietLoading ? (
              <TableSkeleton rows={6} />
            ) : dietPlans.length === 0 ? (
              <EmptyState
                icon={Salad}
                title="No diet plans found"
                description="Create your first diet plan to start guiding member nutrition."
                action={
                  <Button
                    onClick={() => {
                      setEditDietPlan(null);
                      setDietFormOpen(true);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4" /> New Diet Plan
                  </Button>
                }
              />
            ) : (
              <DietPlanTable
                plans={dietPlans}
                onEdit={(plan) => {
                  setEditDietPlan(plan);
                  setDietFormOpen(true);
                }}
                onAssign={(plan) => setAssignDietPlan(plan)}
                onDeactivate={(plan) => setDeactivateDiet(plan)}
              />
            )}

            <DietAssignmentsSection />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────── */}
      <WorkoutPlanFormDialog
        open={workoutFormOpen}
        onOpenChange={(open) => {
          setWorkoutFormOpen(open);
          if (!open) setEditWorkoutPlan(null);
        }}
        plan={editWorkoutPlan}
      />
      <DietPlanFormDialog
        open={dietFormOpen}
        onOpenChange={(open) => {
          setDietFormOpen(open);
          if (!open) setEditDietPlan(null);
        }}
        plan={editDietPlan}
      />
      <AssignWorkoutPlanDialog
        open={!!assignWorkoutPlan}
        onOpenChange={(open) => !open && setAssignWorkoutPlan(null)}
        plan={assignWorkoutPlan}
      />
      <AssignDietPlanDialog
        open={!!assignDietPlan}
        onOpenChange={(open) => !open && setAssignDietPlan(null)}
        plan={assignDietPlan}
      />
      <ConfirmDialog
        open={!!deactivateWorkout}
        onOpenChange={(open) => !open && setDeactivateWorkout(null)}
        title="Deactivate Workout Plan"
        description={`Deactivate "${deactivateWorkout?.title ?? ""}"? Existing assignments are kept, but the plan can no longer be assigned.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivateWorkoutMutation.isPending}
        onConfirm={() => {
          if (deactivateWorkout) {
            deactivateWorkoutMutation.mutate(deactivateWorkout.id, {
              onSettled: () => setDeactivateWorkout(null),
            });
          }
        }}
      />
      <ConfirmDialog
        open={!!deactivateDiet}
        onOpenChange={(open) => !open && setDeactivateDiet(null)}
        title="Deactivate Diet Plan"
        description={`Deactivate "${deactivateDiet?.title ?? ""}"? Existing assignments are kept, but the plan can no longer be assigned.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivateDietMutation.isPending}
        onConfirm={() => {
          if (deactivateDiet) {
            deactivateDietMutation.mutate(deactivateDiet.id, {
              onSettled: () => setDeactivateDiet(null),
            });
          }
        }}
      />
    </AppLayout>
  );
}
