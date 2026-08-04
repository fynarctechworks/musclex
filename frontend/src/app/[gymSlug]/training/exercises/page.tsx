"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Archive, Sparkles, Dumbbell } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied, PageHeader, EmptyState } from "@/components/shared";
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
import {
  useExercises,
  useCreateExercise,
  useUpdateExercise,
  useArchiveExercise,
  useSeedExercises,
  MUSCLE_GROUPS,
  type ExerciseDetail,
} from "@/features/plans";

const GROUP_LABEL: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  full_body: "Full body",
  cardio: "Cardio",
};

/**
 * Exercise library management.
 *
 * The catalog was read-only AND shipped with no seed data, so a new gym's
 * workout-plan builder opened with an empty picker and nothing could be added.
 */
export default function ExerciseLibraryPage() {
  const { allowed, checked } = useRequirePermission("members", "view", "deny");
  const { gymPath } = useGymSlug();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission("members", "edit");

  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [editing, setEditing] = useState<ExerciseDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ExerciseDetail | null>(null);

  const { data, isLoading } = useExercises({
    search: search || undefined,
    muscle_group: group || undefined,
    limit: 200,
  });

  const createEx = useCreateExercise();
  const updateEx = useUpdateExercise();
  const archiveEx = useArchiveExercise();
  const seedEx = useSeedExercises();

  const exercises = (data?.data ?? []) as ExerciseDetail[];

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (ex: ExerciseDetail) => {
    setEditing(ex);
    setDialogOpen(true);
  };

  const submit = (form: FormData) => {
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      muscle_group: (String(form.get("muscle_group") ?? "") || null) as string | null,
      equipment: (String(form.get("equipment") ?? "").trim() || null) as string | null,
      instructions: (String(form.get("instructions") ?? "").trim() || null) as string | null,
    };
    if (!payload.name) return;

    if (editing) {
      updateEx.mutate(
        { id: editing.id, data: payload },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createEx.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/training/plans")}
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Training Plans
      </Link>

      <PageHeader
        title="Exercise Library"
        description="The catalog your workout plans are built from"
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => seedEx.mutate()}
                disabled={seedEx.isPending}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {seedEx.isPending ? "Adding…" : "Add starter set"}
              </Button>
              <Button className="bg-primary text-primary-foreground" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1.5" /> New exercise
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mt-6 mb-4">
        <Input
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs bg-background border-border text-foreground"
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground sm:w-[180px]"
        >
          <option value="">All muscle groups</option>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g] ?? g}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : exercises.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={Dumbbell}
            title="No exercises yet"
            description="Add the starter set to get a ready-made catalog, or create your own exercises."
            action={
              canEdit ? (
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={() => seedEx.mutate()}
                  disabled={seedEx.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" /> Add starter set
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas-soft">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Exercise</th>
                <th className="px-4 py-2.5 font-medium">Muscle group</th>
                <th className="px-4 py-2.5 font-medium">Equipment</th>
                {canEdit && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex) => (
                <tr key={ex.id} className="border-t border-border hover:bg-canvas-soft">
                  <td className="px-4 py-3 text-foreground font-medium">{ex.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ex.muscle_group ? GROUP_LABEL[ex.muscle_group] ?? ex.muscle_group : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {ex.equipment ?? "—"}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(ex)}
                          title="Edit"
                          className="p-1.5 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setArchiveTarget(ex)}
                          title="Archive"
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit exercise" : "New exercise"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="ex-name">Name</Label>
              <Input
                id="ex-name"
                name="name"
                defaultValue={editing?.name ?? ""}
                required
                minLength={2}
                placeholder="e.g. Barbell Bench Press"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ex-group">Muscle group</Label>
                <select
                  id="ex-group"
                  name="muscle_group"
                  defaultValue={editing?.muscle_group ?? ""}
                  className="w-full mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                >
                  <option value="">—</option>
                  {MUSCLE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABEL[g] ?? g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ex-equipment">Equipment</Label>
                <Input
                  id="ex-equipment"
                  name="equipment"
                  defaultValue={editing?.equipment ?? ""}
                  placeholder="barbell, machine…"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ex-instructions">Instructions (optional)</Label>
              <Textarea
                id="ex-instructions"
                name="instructions"
                defaultValue={editing?.instructions ?? ""}
                placeholder="Cues, setup, tempo…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                disabled={createEx.isPending || updateEx.isPending}
              >
                {editing ? "Save changes" : "Add exercise"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive exercise?"
        description={`"${archiveTarget?.name}" will be hidden from the plan builder. Existing plans and training history keep referencing it.`}
        confirmLabel="Archive"
        onConfirm={() => {
          if (archiveTarget) archiveEx.mutate(archiveTarget.id);
          setArchiveTarget(null);
        }}
      />
    </AppLayout>
  );
}
