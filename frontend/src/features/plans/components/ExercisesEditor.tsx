'use client';

import React, { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExercises } from '../hooks';
import type { WorkoutPlanDetail, WorkoutPlanExerciseInput } from '../types';

/**
 * Draft row for the exercises editor. Numeric fields are kept as strings so
 * the inputs stay controlled and empty values are representable; parsing to
 * numbers happens in `draftsToExerciseInputs` on submit.
 */
export interface ExerciseDraft {
  key: string;
  exercise_id: string;
  exercise_name: string;
  position: string;
  target_sets: string;
  target_reps: string;
  target_weight: string;
  rest_seconds: string;
  notes: string;
}

let draftSeq = 0;
function nextKey(): string {
  draftSeq += 1;
  return `ex-draft-${draftSeq}`;
}

export function emptyExerciseDraft(position: number): ExerciseDraft {
  return {
    key: nextKey(),
    exercise_id: '',
    exercise_name: '',
    position: String(position),
    target_sets: '',
    target_reps: '',
    target_weight: '',
    rest_seconds: '',
    notes: '',
  };
}

export function planExercisesToDrafts(
  plan: WorkoutPlanDetail,
): ExerciseDraft[] {
  return plan.exercises.map((ex) => ({
    key: nextKey(),
    exercise_id: ex.exercise_id,
    exercise_name: ex.exercise?.name ?? '',
    position: String(ex.position),
    target_sets: ex.target_sets != null ? String(ex.target_sets) : '',
    target_reps: ex.target_reps != null ? String(ex.target_reps) : '',
    target_weight: ex.target_weight != null ? String(ex.target_weight) : '',
    rest_seconds: ex.rest_seconds != null ? String(ex.rest_seconds) : '',
    notes: ex.notes ?? '',
  }));
}

function parseNum(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Drop rows without an exercise selected; parse numerics. */
export function draftsToExerciseInputs(
  drafts: ExerciseDraft[],
): WorkoutPlanExerciseInput[] {
  return drafts
    .filter((d) => d.exercise_id)
    .map((d, i) => ({
      exercise_id: d.exercise_id,
      position: parseNum(d.position) ?? i + 1,
      target_sets: parseNum(d.target_sets),
      target_reps: parseNum(d.target_reps),
      target_weight: parseNum(d.target_weight),
      rest_seconds: parseNum(d.rest_seconds),
      notes: d.notes.trim() || undefined,
    }));
}

// ── Exercise picker (search dropdown, same pattern as member search) ──

function ExercisePicker({
  draft,
  onSelect,
  onClear,
}: {
  draft: ExerciseDraft;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data } = useExercises(
    search ? { search, limit: 10 } : { limit: 10 },
  );
  const exercises = data?.data ?? [];

  if (draft.exercise_id) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm text-foreground">
        <span className="truncate font-medium">{draft.exercise_name}</span>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 bg-muted border-border pl-8 text-sm text-foreground placeholder:text-muted-foreground"
      />
      {search && exercises.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-card shadow-level-2">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                onSelect(ex.id, ex.name);
                setSearch('');
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span className="font-medium">{ex.name}</span>
              <span className="text-xs text-muted-foreground">
                {[ex.muscle_group, ex.equipment].filter(Boolean).join(' · ') ||
                  '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor ──────────────────────────────────────────────────────

interface ExercisesEditorProps {
  value: ExerciseDraft[];
  onChange: (drafts: ExerciseDraft[]) => void;
}

export function ExercisesEditor({ value, onChange }: ExercisesEditorProps) {
  const updateRow = (key: string, patch: Partial<ExerciseDraft>) => {
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeRow = (key: string) => {
    onChange(value.filter((d) => d.key !== key));
  };

  const addRow = () => {
    onChange([...value, emptyExerciseDraft(value.length + 1)]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-foreground">Exercises</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          className="h-8 text-xs"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Exercise
        </Button>
      </div>

      {value.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No exercises yet — add the first one.
        </p>
      )}

      {value.map((draft) => (
        <div
          key={draft.key}
          className="space-y-2 rounded-lg border border-border bg-canvas-soft p-3"
        >
          <div className="flex items-start gap-2">
            <div className="w-14 shrink-0">
              <Label className="text-[11px] text-muted-foreground">Order</Label>
              <Input
                type="number"
                min={1}
                value={draft.position}
                onChange={(e) =>
                  updateRow(draft.key, { position: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Label className="text-[11px] text-muted-foreground">
                Exercise
              </Label>
              <ExercisePicker
                draft={draft}
                onSelect={(id, name) =>
                  updateRow(draft.key, {
                    exercise_id: id,
                    exercise_name: name,
                  })
                }
                onClear={() =>
                  updateRow(draft.key, { exercise_id: '', exercise_name: '' })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(draft.key)}
              className="mt-4 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove exercise"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Sets</Label>
              <Input
                type="number"
                min={0}
                placeholder="3"
                value={draft.target_sets}
                onChange={(e) =>
                  updateRow(draft.key, { target_sets: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Reps</Label>
              <Input
                type="number"
                min={0}
                placeholder="12"
                value={draft.target_reps}
                onChange={(e) =>
                  updateRow(draft.key, { target_reps: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Weight (kg)
              </Label>
              <Input
                type="number"
                min={0}
                step="0.5"
                placeholder="20"
                value={draft.target_weight}
                onChange={(e) =>
                  updateRow(draft.key, { target_weight: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Rest (sec)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="60"
                value={draft.rest_seconds}
                onChange={(e) =>
                  updateRow(draft.key, { rest_seconds: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <Input
            placeholder="Notes (optional)"
            value={draft.notes}
            onChange={(e) => updateRow(draft.key, { notes: e.target.value })}
            className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
      ))}
    </div>
  );
}
