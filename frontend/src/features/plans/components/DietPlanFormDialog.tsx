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
import { useCreateDietPlan, useDietPlan, useUpdateDietPlan } from '../hooks';
import type { DietGoal, DietPlan } from '../types';
import { dietGoalLabels } from '../types';
import {
  draftsToMealInputs,
  MealDraft,
  MealsEditor,
  planMealsToDrafts,
} from './MealsEditor';

const NONE = 'none';

function parseNum(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

interface DietPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a plan to edit; omit/null to create. */
  plan?: DietPlan | null;
}

export function DietPlanFormDialog({
  open,
  onOpenChange,
  plan,
}: DietPlanFormDialogProps) {
  const isEdit = !!plan;
  const { data: detail, isLoading: detailLoading } = useDietPlan(
    open && plan ? plan.id : undefined,
  );
  const createMutation = useCreateDietPlan();
  const updateMutation = useUpdateDietPlan();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState<string>(NONE);
  const [dailyCalories, setDailyCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [meals, setMeals] = useState<MealDraft[]>([]);

  // Hydrate on open: from detail when editing, blank when creating.
  useEffect(() => {
    if (!open) return;
    if (plan && detail && detail.id === plan.id) {
      setTitle(detail.title);
      setDescription(detail.description ?? '');
      setGoal(detail.goal ?? NONE);
      setDailyCalories(
        detail.daily_calories != null ? String(detail.daily_calories) : '',
      );
      setProteinG(detail.protein_g != null ? String(detail.protein_g) : '');
      setCarbsG(detail.carbs_g != null ? String(detail.carbs_g) : '');
      setFatG(detail.fat_g != null ? String(detail.fat_g) : '');
      setIsTemplate(detail.is_template);
      setMeals(planMealsToDrafts(detail));
    } else if (!plan) {
      setTitle('');
      setDescription('');
      setGoal(NONE);
      setDailyCalories('');
      setProteinG('');
      setCarbsG('');
      setFatG('');
      setIsTemplate(false);
      setMeals([]);
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
      goal: goal !== NONE ? (goal as DietGoal) : undefined,
      daily_calories: parseNum(dailyCalories),
      protein_g: parseNum(proteinG),
      carbs_g: parseNum(carbsG),
      fat_g: parseNum(fatG),
      is_template: isTemplate,
      meals: draftsToMealInputs(meals),
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
            {isEdit ? 'Edit Diet Plan' : 'New Diet Plan'}
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
                placeholder="e.g. Lean Bulk — 2600 kcal"
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

            <div className="space-y-2">
              <Label className="text-foreground">Goal</Label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value={NONE}>No goal</SelectItem>
                  {(
                    Object.entries(dietGoalLabels) as [DietGoal, string][]
                  ).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Daily kcal</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="2200"
                  value={dailyCalories}
                  onChange={(e) => setDailyCalories(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Protein (g)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="150"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Carbs (g)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="220"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Fat (g)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="70"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
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

            <MealsEditor value={meals} onChange={setMeals} />

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
