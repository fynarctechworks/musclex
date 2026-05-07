"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateExpense, type CreateExpenseInput } from "@/features/payments";
import {
  enqueueExpense,
  generateIdempotencyKey,
} from "@/features/expenses/offline-queue";
import type { ExpenseCategory } from "@/types";
import { CategoryChipRow } from "./CategoryChipRow";

interface QuickAddBarProps {
  branchId: string;
  categories: ExpenseCategory[];
  autoFocus?: boolean;
  onQueued?: (id: string) => void;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank" },
] as const;

export function QuickAddBar({
  branchId,
  categories,
  autoFocus,
  onQueued,
}: QuickAddBarProps) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<CreateExpenseInput["payment_method"]>("cash");
  const [note, setNote] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) amountRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      const firstActive = categories.find((c) => c.is_active) ?? categories[0];
      setCategoryId(firstActive.id);
    }
  }, [categories, categoryId]);

  const createExpense = useCreateExpense();

  const reset = () => {
    setAmount("");
    setNote("");
    amountRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!categoryId) {
      toast.error("Pick a category");
      return;
    }
    const selected = categories.find((c) => c.id === categoryId);

    const payload: CreateExpenseInput = {
      branch_id: branchId,
      category_id: categoryId,
      description: note.trim() || selected?.name || "Expense",
      amount: parsed,
      expense_date: new Date().toISOString().slice(0, 10),
      payment_method: method,
      idempotency_key: generateIdempotencyKey(),
    };

    try {
      await createExpense.mutateAsync(payload);
      reset();
    } catch {
      // Network or server hiccup — persist locally so we can resend.
      try {
        const entry = await enqueueExpense(payload);
        toast.message("Queued — will sync when back online");
        onQueued?.(entry.idempotency_key);
        reset();
      } catch {
        toast.error("Could not save expense");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Zap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Amount"
            className="h-11 border-border bg-background pl-9 text-base font-semibold text-foreground"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        <Button
          type="submit"
          disabled={createExpense.isPending}
          className="h-11 gap-1 bg-primary px-4 text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        {PAYMENT_METHODS.map((m) => {
          const active = method === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          );
        })}
        <span className="shrink-0 text-xs text-muted-foreground">•</span>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="h-8 flex-1 border-border bg-background text-sm"
        />
      </div>

      <div className="mt-3">
        <CategoryChipRow
          categories={categories}
          selectedId={categoryId}
          onSelect={setCategoryId}
        />
      </div>
    </form>
  );
}
