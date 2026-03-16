"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import type { BodyStat } from "@/features/progress";

const schema = z.object({
  recorded_at: z.string().min(1, "Date is required"),
  weight: z.string().optional(),
  body_fat: z.string().optional(),
  muscle_mass: z.string().optional(),
  bmi: z.string().optional(),
  chest: z.string().optional(),
  waist: z.string().optional(),
  hips: z.string().optional(),
  arms: z.string().optional(),
  thighs: z.string().optional(),
  calves: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const FIELDS = [
  { name: "weight" as const, label: "Weight", unit: "kg" },
  { name: "body_fat" as const, label: "Body Fat", unit: "%" },
  { name: "muscle_mass" as const, label: "Muscle Mass", unit: "kg" },
  { name: "bmi" as const, label: "BMI", unit: "" },
  { name: "chest" as const, label: "Chest", unit: "cm" },
  { name: "waist" as const, label: "Waist", unit: "cm" },
  { name: "hips" as const, label: "Hips", unit: "cm" },
  { name: "arms" as const, label: "Arms", unit: "cm" },
  { name: "thighs" as const, label: "Thighs", unit: "cm" },
  { name: "calves" as const, label: "Calves", unit: "cm" },
] as const;

interface EditMeasurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stat: BodyStat | null;
  onSubmit: (statsId: string, data: Record<string, unknown>) => void;
  loading?: boolean;
}

export function EditMeasurementDialog({
  open,
  onOpenChange,
  stat,
  onSubmit,
  loading,
}: EditMeasurementDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (stat && open) {
      reset({
        recorded_at: format(parseISO(stat.recorded_at), "yyyy-MM-dd"),
        weight: stat.weight !== null ? String(stat.weight) : "",
        body_fat: stat.body_fat !== null ? String(stat.body_fat) : "",
        muscle_mass: stat.muscle_mass !== null ? String(stat.muscle_mass) : "",
        bmi: stat.bmi !== null ? String(stat.bmi) : "",
        chest: stat.chest !== null ? String(stat.chest) : "",
        waist: stat.waist !== null ? String(stat.waist) : "",
        hips: stat.hips !== null ? String(stat.hips) : "",
        arms: stat.arms !== null ? String(stat.arms) : "",
        thighs: stat.thighs !== null ? String(stat.thighs) : "",
        calves: stat.calves !== null ? String(stat.calves) : "",
      });
    }
  }, [stat, open, reset]);

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>Edit Measurement</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => {
            if (!stat) return;
            const payload: Record<string, unknown> = { recorded_at: data.recorded_at };
            for (const f of FIELDS) {
              const v = data[f.name];
              if (v) {
                const num = parseFloat(v);
                if (!isNaN(num)) {
                  payload[f.name] = num;
                } else {
                  payload[f.name] = null;
                }
              } else {
                payload[f.name] = null;
              }
            }
            onSubmit(stat.id, payload);
          })}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="edit-recorded_at">Date</Label>
            <Input
              id="edit-recorded_at"
              type="date"
              {...register("recorded_at")}
              className="mt-1 bg-muted border-border"
            />
            {errors.recorded_at && (
              <p className="text-xs text-destructive mt-1">{errors.recorded_at.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.name}>
                <Label htmlFor={`edit-${f.name}`}>
                  {f.label} {f.unit && <span className="text-muted-foreground">({f.unit})</span>}
                </Label>
                <Input
                  id={`edit-${f.name}`}
                  type="number"
                  step="0.1"
                  placeholder="—"
                  {...register(f.name)}
                  className="mt-1 bg-muted border-border"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Update Measurement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
