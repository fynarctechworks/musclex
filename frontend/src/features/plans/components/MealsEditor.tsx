'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  DietMealItem,
  DietPlanDetail,
  DietPlanMealInput,
  MealType,
} from '../types';
import { mealTypeLabels } from '../types';

/**
 * Draft row for the meals editor. Items are edited as free text, one item per
 * line in the form "food — quantity" (a plain "-" separator also works);
 * numeric fields stay strings until submit.
 */
export interface MealDraft {
  key: string;
  meal_type: MealType;
  position: string;
  title: string;
  itemsText: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  notes: string;
}

let draftSeq = 0;
function nextKey(): string {
  draftSeq += 1;
  return `meal-draft-${draftSeq}`;
}

export function emptyMealDraft(position: number): MealDraft {
  return {
    key: nextKey(),
    meal_type: 'breakfast',
    position: String(position),
    title: '',
    itemsText: '',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    notes: '',
  };
}

function itemsToText(items: DietMealItem[] | null | undefined): string {
  if (!items || items.length === 0) return '';
  return items
    .map((it) =>
      it.quantity ? `${it.food} — ${it.quantity}` : it.food,
    )
    .join('\n');
}

/** Parse "food — quantity" lines (em-dash, " - ", or ":" separators). */
export function parseItemsText(text: string): DietMealItem[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const seps = [' — ', '—', ' - ', ' : ', ':'];
      for (const sep of seps) {
        const idx = line.indexOf(sep);
        if (idx > 0) {
          return {
            food: line.slice(0, idx).trim(),
            quantity: line.slice(idx + sep.length).trim(),
          };
        }
      }
      return { food: line, quantity: '' };
    });
}

export function planMealsToDrafts(plan: DietPlanDetail): MealDraft[] {
  return plan.meals.map((meal) => ({
    key: nextKey(),
    meal_type: meal.meal_type,
    position: String(meal.position),
    title: meal.title,
    itemsText: itemsToText(meal.items),
    calories: meal.calories != null ? String(meal.calories) : '',
    protein_g: meal.protein_g != null ? String(meal.protein_g) : '',
    carbs_g: meal.carbs_g != null ? String(meal.carbs_g) : '',
    fat_g: meal.fat_g != null ? String(meal.fat_g) : '',
    notes: meal.notes ?? '',
  }));
}

function parseNum(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Drop rows without a title; parse items + numerics. */
export function draftsToMealInputs(drafts: MealDraft[]): DietPlanMealInput[] {
  return drafts
    .filter((d) => d.title.trim())
    .map((d, i) => ({
      meal_type: d.meal_type,
      position: parseNum(d.position) ?? i + 1,
      title: d.title.trim(),
      items: parseItemsText(d.itemsText),
      calories: parseNum(d.calories),
      protein_g: parseNum(d.protein_g),
      carbs_g: parseNum(d.carbs_g),
      fat_g: parseNum(d.fat_g),
      notes: d.notes.trim() || undefined,
    }));
}

// ── Editor ──────────────────────────────────────────────────────

interface MealsEditorProps {
  value: MealDraft[];
  onChange: (drafts: MealDraft[]) => void;
}

export function MealsEditor({ value, onChange }: MealsEditorProps) {
  const updateRow = (key: string, patch: Partial<MealDraft>) => {
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeRow = (key: string) => {
    onChange(value.filter((d) => d.key !== key));
  };

  const addRow = () => {
    onChange([...value, emptyMealDraft(value.length + 1)]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-foreground">Meals</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          className="h-8 text-xs"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Meal
        </Button>
      </div>

      {value.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No meals yet — add the first one.
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
            <div className="w-32 shrink-0">
              <Label className="text-[11px] text-muted-foreground">Meal</Label>
              <Select
                value={draft.meal_type}
                onValueChange={(v) =>
                  updateRow(draft.key, { meal_type: v as MealType })
                }
              >
                <SelectTrigger className="h-9 bg-muted border-border text-sm text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {(
                    Object.entries(mealTypeLabels) as [MealType, string][]
                  ).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input
                placeholder="e.g. Oats bowl with fruit"
                value={draft.title}
                onChange={(e) =>
                  updateRow(draft.key, { title: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(draft.key)}
              className="mt-4 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove meal"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">
              Items — one per line as &quot;food — quantity&quot;
            </Label>
            <Textarea
              rows={3}
              placeholder={'Rolled oats — 60 g\nBanana — 1 medium\nPeanut butter — 1 tbsp'}
              value={draft.itemsText}
              onChange={(e) =>
                updateRow(draft.key, { itemsText: e.target.value })
              }
              className="bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Calories
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="450"
                value={draft.calories}
                onChange={(e) =>
                  updateRow(draft.key, { calories: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Protein (g)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="25"
                value={draft.protein_g}
                onChange={(e) =>
                  updateRow(draft.key, { protein_g: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Carbs (g)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="60"
                value={draft.carbs_g}
                onChange={(e) =>
                  updateRow(draft.key, { carbs_g: e.target.value })
                }
                className="h-9 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Fat (g)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="15"
                value={draft.fat_g}
                onChange={(e) =>
                  updateRow(draft.key, { fat_g: e.target.value })
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
