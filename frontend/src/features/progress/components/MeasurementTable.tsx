"use client";

import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import type { BodyStat } from "@/features/progress";

interface MeasurementTableProps {
  data?: BodyStat[];
  loading?: boolean;
  onEdit?: (stat: BodyStat) => void;
  onDelete?: (statsId: string) => void;
  deleteLoading?: boolean;
  className?: string;
}

export function MeasurementTable({
  data,
  loading,
  onEdit,
  onDelete,
  deleteLoading,
  className,
}: MeasurementTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 bg-muted rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-canvas-soft rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-6", className)}>
        <EmptyState
          icon={Ruler}
          title="No measurements recorded"
          description="Add your first body measurement to start tracking progress."
        />
      </div>
    );
  }

  const fmt = (v: number | null) => (v !== null ? Number(v).toFixed(1) : "—");

  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <h3 className="text-base font-semibold text-foreground mb-4">Measurement History</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Date", "Weight", "Fat %", "Muscle", "BMI", "Chest", "Waist", "Hips", "Arms", "Thighs", "Calves", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap px-2 first:pl-0"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((stat) => (
              <tr key={stat.id} className="border-b border-border last:border-0">
                <td className="py-3 px-2 first:pl-0 text-foreground whitespace-nowrap">
                  {format(parseISO(stat.recorded_at), "MMM dd, yyyy")}
                </td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.weight)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.body_fat)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.muscle_mass)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.bmi)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.chest)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.waist)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.hips)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.arms)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.thighs)}</td>
                <td className="py-3 px-2 text-muted-foreground">{fmt(stat.calves)}</td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(stat)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(stat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Measurement"
        description="Are you sure you want to delete this measurement? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteId && onDelete) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
        loading={deleteLoading}
      />
    </div>
  );
}
