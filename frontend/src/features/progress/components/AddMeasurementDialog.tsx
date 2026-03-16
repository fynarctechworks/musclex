"use client";

import React from "react";
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
import { format } from "date-fns";

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

interface AddMeasurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => void;
  loading?: boolean;
}

export function AddMeasurementDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: AddMeasurementDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      recorded_at: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add Measurement</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => {
            const payload: Record<string, unknown> = { recorded_at: data.recorded_at };
            for (const f of FIELDS) {
              const v = data[f.name];
              if (v) {
                const num = parseFloat(v);
                if (!isNaN(num)) payload[f.name] = num;
              }
            }
            onSubmit(payload);
          })}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="recorded_at">Date</Label>
            <Input
              id="recorded_at"
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
                <Label htmlFor={f.name}>
                  {f.label} {f.unit && <span className="text-muted-foreground">({f.unit})</span>}
                </Label>
                <Input
                  id={f.name}
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
              {loading ? "Saving…" : "Save Measurement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
