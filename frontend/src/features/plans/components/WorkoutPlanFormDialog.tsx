'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useCreateWorkoutPlan,
  useUpdateWorkoutPlan,
  useWorkoutPlan,
} from '../hooks';
import type { Difficulty, WorkoutGoal, WorkoutPlan } from '../types';
import { difficultyLabels, workoutGoalLabels } from '../types';
import {
  draftsToExerciseInputs,
  ExerciseDraft,
  ExercisesEditor,
  planExercisesToDrafts,
} from './ExercisesEditor';

const NONE = 'none';

interface WorkoutPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a plan to edit; omit/null to create. */
  plan?: WorkoutPlan | null;
}

export function WorkoutPlanFormDialog({
  open,
  onOpenChange,
  plan,
}: WorkoutPlanFormDialogProps) {
  const isEdit = !!plan;
  const { data: detail, isLoading: detailLoading } = useWorkoutPlan(
    open && plan ? plan.id : undefined,
  );
  const createMutation = useCreateWorkoutPlan();
  const updateMutation = useUpdateWorkoutPlan();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState<string>(NONE);
  const [difficulty, setDifficulty] = useState<string>(NONE);
  const [isTemplate, setIsTemplate] = useState(false);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);

  // Hydrate on open: from detail when editing, blank when creating.
  useEffect(() => {
    if (!open) return;
    if (plan && detail && detail.id === plan.id) {
      setTitle(detail.title);
      setDescription(detail.description ?? '');
      setGoal(detail.goal ?? NONE);
      setDifficulty(detail.difficulty ?? NONE);
      setIsTemplate(detail.is_template);
      setExercises(planExercisesToDrafts(detail));
    } else if (!plan) {
      setTitle('');
      setDescription('');
      setGoal(NONE);
      setDifficulty(NONE);
      setIsTemplate(false);
      setExercises([]);
    }
  }, [open, plan, detail]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      goal: goal !== NONE ? (goal as WorkoutGoal) : undefined,
      difficulty: difficulty !== NONE ? (difficulty as Difficulty) : undefined,
      is_template: isTemplate,
      exercises: draftsToExerciseInputs(exercises),
    };
    const onSuccess = () => onOpenChange(false);
    if (isEdit && plan) {
      updateMutation.mutate({ id: plan.id, data: payload }, { onSuccess });
    } else {
      createMutation.mutate(payload, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Workout Plan' : 'New Workout Plan'}
          </DialogTitle>
        </DialogHeader>

        {isEdit && detailLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading plan...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Push / Pull / Legs — Week A"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this plan is for and who it suits"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">Goal</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value={NONE}>No goal</SelectItem>
                    {(
                      Object.entries(workoutGoalLabels) as [
                        WorkoutGoal,
                        string,
                      ][]
                    ).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value={NONE}>Not set</SelectItem>
                    {(
                      Object.entries(difficultyLabels) as [
                        Difficulty,
                        string,
                      ][]
                    ).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-canvas-soft px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Save as template
                </p>
                <p className="text-xs text-muted-foreground">
                  Templates are reusable starting points for member plans.
                </p>
              </div>
              <Switch checked={isTemplate} onCheckedChange={setIsTemplate} />
            </div>

            <ExercisesEditor value={exercises} onChange={setExercises} />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isPending
                  ? 'Saving...'
                  : isEdit
                    ? 'Save Changes'
                    : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
