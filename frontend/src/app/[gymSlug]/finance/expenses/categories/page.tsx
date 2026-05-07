"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import {
  useCreateExpenseCategory,
  useDeactivateExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from "@/features/payments";
import type { ExpenseCategory } from "@/types";

export default function ExpenseCategoriesPage() {
  const { allowed, checked } = useRequirePermission("payments", "view", "deny");
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#4A9FD4");
  const [scope, setScope] = useState<"branch" | "gym">("branch");

  const { data: raw } = useExpenseCategories(
    activeBranchId ?? undefined,
    true,
  );
  const categories = (raw as ExpenseCategory[] | undefined) ?? [];
  const createMut = useCreateExpenseCategory();
  const updateMut = useUpdateExpenseCategory();
  const deactivateMut = useDeactivateExpenseCategory();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createMut.mutateAsync({
      name: name.trim(),
      color,
      branch_id: scope === "branch" ? activeBranchId : null,
    });
    setName("");
    setColor("#4A9FD4");
    setDialogOpen(false);
  };

  const toggleActive = (cat: ExpenseCategory) => {
    if (cat.is_default) return;
    if (cat.is_active) {
      deactivateMut.mutate(cat.id);
    } else {
      updateMut.mutate({ id: cat.id, data: { is_active: true } });
    }
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/finance/expenses")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to expenses
      </Link>
      <PageHeader
        title="Expense Categories"
        description="Manage your branch-scoped and gym-wide categories"
        actions={
          <Button
            className="h-10 gap-1 bg-primary text-primary-foreground"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4" /> New Category
          </Button>
        }
        className="mb-5"
      />

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id} className={!c.is_active ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: c.color ?? "#4A9FD4" }}
                      />
                      <span className="text-foreground">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.slug}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.branch_id ? "Branch" : "Gym-wide"}
                  </TableCell>
                  <TableCell>
                    {c.is_default ? (
                      <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] uppercase text-primary">
                        Default
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                        c.is_active
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={c.is_default || deactivateMut.isPending || updateMut.isPending}
                      onClick={() => toggleActive(c)}
                      className="h-8 border-border text-xs"
                    >
                      {c.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Expense Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Software subscriptions"
                className="border-border bg-background"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Color
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 cursor-pointer rounded border border-border bg-background"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Scope
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScope("branch")}
                  disabled={!activeBranchId}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs ${
                    scope === "branch"
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  This branch only
                </button>
                <button
                  type="button"
                  onClick={() => setScope("gym")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs ${
                    scope === "gym"
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  Gym-wide
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-border"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || createMut.isPending}
                className="bg-primary text-primary-foreground"
              >
                {createMut.isPending ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
