"use client";

import { useState } from "react";
import { Check, Tag, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReverseExpense } from "@/features/payments";
import { useCurrency } from "@/lib/hooks/use-currency";
import type { Expense } from "@/types";

interface ExpenseRowProps {
  expense: Expense;
}

export function ExpenseRow({ expense }: ExpenseRowProps) {
  const CURRENCY = useCurrency();
  const reverse = useReverseExpense();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const isReversed = expense.status === "reversed";
  const isReversal = !!expense.reference_id;
  const amount = Number(expense.amount);
  const label = expense.category_ref?.name ?? expense.category;
  const chipColor = expense.category_ref?.color ?? "#4A9FD4";

  const handleReverse = async () => {
    await reverse.mutateAsync({ id: expense.id, reason: reason || undefined });
    setConfirming(false);
    setReason("");
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${
        isReversed
          ? "border-dashed border-border bg-card/40 opacity-70"
          : isReversal
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${chipColor}22`, color: chipColor }}
          >
            <Tag className="h-3 w-3" /> {label}
          </span>
          {expense.payment_method && (
            <span className="text-[10px] uppercase text-muted-foreground">
              {expense.payment_method.replace("_", " ")}
            </span>
          )}
          {isReversed && (
            <span className="text-[10px] font-medium text-amber-500">
              REVERSED
            </span>
          )}
          {isReversal && (
            <span className="text-[10px] font-medium text-amber-500">
              REVERSAL
            </span>
          )}
        </div>
        <p
          className={`mt-0.5 truncate text-sm ${
            isReversed ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {expense.description}
        </p>
        {expense.vendor && (
          <p className="truncate text-xs text-muted-foreground">
            {expense.vendor}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="text-right">
          <p
            className={`text-sm font-semibold ${
              amount < 0 ? "text-amber-500" : "text-foreground"
            } ${isReversed ? "line-through" : ""}`}
          >
            {amount < 0 ? "-" : ""}
            {CURRENCY}
            {Math.abs(amount).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {expense.recorded_by?.full_name ?? "—"}
          </p>
        </div>

        {!isReversed && !isReversal && (
          <>
            {confirming ? (
              <div className="flex items-center gap-1">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason"
                  className="h-8 w-32 border-border bg-background text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-border px-2"
                  onClick={() => {
                    setConfirming(false);
                    setReason("");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={reverse.isPending}
                  className="h-8 bg-primary px-2 text-primary-foreground"
                  onClick={() => void handleReverse()}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 border-border text-xs"
                onClick={() => setConfirming(true)}
              >
                <Undo2 className="h-3 w-3" /> Reverse
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
