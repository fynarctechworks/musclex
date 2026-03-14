"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface ExpenseForm {
  amount: string;
  category: string;
  description: string;
  expense_date: string;
  receipt_url: string;
}

const categories = ["salaries", "rent", "equipment", "utilities", "marketing", "maintenance", "other"];

export default function RecordExpensePage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const { register, handleSubmit } = useForm<ExpenseForm>({
    defaultValues: { expense_date: new Date().toISOString().slice(0, 10) },
  });

  const mutation = useMutation({
    mutationFn: (data: ExpenseForm) => apiClient.post("/expenses", data),
    onSuccess: () => { toast.success("Expense recorded"); router.push(gymPath("/finance")); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <Link href={gymPath("/finance")} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-xl font-semibold text-foreground mb-6">Record Expense</h1>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="max-w-lg space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Amount *</label>
          <Input type="number" {...register("amount", { required: true })} className="bg-background border-border text-foreground" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Category *</label>
          <select {...register("category", { required: true })} className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm">
            {categories.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Date *</label>
          <Input type="date" {...register("expense_date", { required: true })} className="bg-background border-border text-foreground" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Description *</label>
          <textarea {...register("description", { required: true })} rows={3} className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Receipt URL</label>
          <Input {...register("receipt_url")} className="bg-background border-border text-foreground" placeholder="https://..." />
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground">Save Expense</Button>
      </form>
    </AppLayout>
  );
}
