"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wallet, Settings2, Play } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied, PageHeader, EmptyState, StatusBadge } from "@/components/shared";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useCurrency } from "@/lib/hooks/use-currency";
import { useAuthStore } from "@/stores/auth-store";
import {
  usePayrollSummary,
  usePayrollRecords,
  useProcessPayroll,
  useUpsertPayrollConfig,
} from "@/features/staff";

interface PayrollSummaryRow {
  staff_id: string;
  full_name: string;
  employee_code?: string | null;
  role: string;
  branch?: { id: string; name: string } | null;
  payroll: {
    salary_type: string;
    base_salary: number;
    commission_percentage: number;
    /** What the gym charges per PT session; prices commission. */
    session_rate?: number | null;
  } | null;
  current_month: {
    revenue_generated: number;
    commission_earned: number;
    total_payout: number;
  };
}

interface PayrollRecordRow {
  id: string;
  staff_id: string;
  salary_period_start: string;
  salary_period_end: string;
  base_amount: string | number;
  commission_amount: string | number;
  bonus: string | number;
  deductions: string | number;
  total_paid: string | number;
  status: string;
  paid_at?: string | null;
  staff?: { full_name: string; employee_code?: string | null } | null;
}

/**
 * Payroll & commissions.
 *
 * The backend (config, MTD summary, pay runs, records, trainer revenue) has
 * been complete for a while and the API client + hooks existed — but no page
 * ever imported them, so payroll was unreachable from the product.
 */
export default function PayrollPage() {
  const { allowed, checked } = useRequirePermission("staff", "view", "deny");
  const { gymPath } = useGymSlug();
  const CURRENCY = useCurrency();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission("staff", "edit");

  const [configFor, setConfigFor] = useState<PayrollSummaryRow | null>(null);
  const [runFor, setRunFor] = useState<PayrollSummaryRow | null>(null);

  const { data: summary, isLoading } = usePayrollSummary(
    activeBranchId ? { branch_id: activeBranchId } : undefined,
  );
  const { data: records, isLoading: recordsLoading } = usePayrollRecords({ limit: 100 });

  const upsertConfig = useUpsertPayrollConfig();
  const processPayroll = useProcessPayroll();

  const rows = (summary ?? []) as PayrollSummaryRow[];
  const recordRows = ((records as { data?: PayrollRecordRow[] })?.data ??
    (records as PayrollRecordRow[]) ??
    []) as PayrollRecordRow[];

  const money = (n: number | string) =>
    `${CURRENCY}${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const totalMonthly = rows.reduce((s, r) => s + (r.current_month?.total_payout ?? 0), 0);
  const totalCommission = rows.reduce((s, r) => s + (r.current_month?.commission_earned ?? 0), 0);

  const submitConfig = (form: FormData) => {
    if (!configFor) return;
    upsertConfig.mutate(
      {
        staff_id: configFor.staff_id,
        salary_type: String(form.get("salary_type") ?? "fixed") as
          | "fixed"
          | "commission"
          | "hybrid",
        base_salary: Number(form.get("base_salary") ?? 0),
        commission_percentage: Number(form.get("commission_percentage") ?? 0),
        // Merged into bonus_structure server-side so sibling pay-config keys
        // survive. 0 / blank means "use the platform default".
        session_rate: Number(form.get("session_rate") ?? 0),
      },
      { onSuccess: () => setConfigFor(null) },
    );
  };

  const submitRun = (form: FormData) => {
    if (!runFor) return;
    processPayroll.mutate(
      {
        staff_id: runFor.staff_id,
        salary_period_start: String(form.get("start") ?? ""),
        salary_period_end: String(form.get("end") ?? ""),
        bonus: Number(form.get("bonus") ?? 0),
        deductions: Number(form.get("deductions") ?? 0),
        notes: String(form.get("notes") ?? "") || undefined,
      },
      { onSuccess: () => setRunFor(null) },
    );
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="staff" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/staff")}
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Staff
      </Link>

      <PageHeader
        title="Payroll & Commissions"
        description="Salary configuration, month-to-date earnings, and pay runs"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Staff on payroll</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {rows.filter((r) => r.payroll).length}
            <span className="text-sm text-muted-foreground font-normal"> / {rows.length}</span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Commission earned (MTD)</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{money(totalCommission)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Projected payout (MTD)</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{money(totalMonthly)}</p>
        </div>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="records">Pay runs</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-6">
          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Wallet}
                title="No active staff"
                description="Add staff members to configure salaries and commissions."
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-canvas-soft">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Staff</th>
                    <th className="px-4 py-2.5 font-medium">Salary type</th>
                    <th className="px-4 py-2.5 font-medium text-right">Base</th>
                    <th className="px-4 py-2.5 font-medium text-right">Comm. %</th>
                    <th className="px-4 py-2.5 font-medium text-right">Revenue (MTD)</th>
                    <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                    <th className="px-4 py-2.5 font-medium text-right">Projected</th>
                    {canEdit && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.staff_id} className="border-t border-border hover:bg-canvas-soft">
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium">{r.full_name}</span>
                        <span className="text-muted-foreground ml-1.5 capitalize">
                          ({r.role?.replace(/_/g, " ")})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {r.payroll?.salary_type ?? (
                          <span className="text-warning">Not configured</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {r.payroll ? money(r.payroll.base_salary) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {r.payroll ? `${r.payroll.commission_percentage}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {money(r.current_month?.revenue_generated ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {money(r.current_month?.commission_earned ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">
                        {money(r.current_month?.total_payout ?? 0)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setConfigFor(r)}
                              title="Configure salary"
                              className="p-1.5 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground"
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRunFor(r)}
                              title="Run payroll"
                              disabled={!r.payroll}
                              className="p-1.5 rounded hover:bg-canvas-soft-2 text-primary disabled:opacity-40"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="records" className="mt-6">
          {recordsLoading ? (
            <TableSkeleton rows={6} />
          ) : recordRows.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Wallet}
                title="No pay runs yet"
                description="Process payroll for a staff member to create the first record."
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-canvas-soft">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Staff</th>
                    <th className="px-4 py-2.5 font-medium">Period</th>
                    <th className="px-4 py-2.5 font-medium text-right">Base</th>
                    <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                    <th className="px-4 py-2.5 font-medium text-right">Bonus</th>
                    <th className="px-4 py-2.5 font-medium text-right">Deductions</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recordRows.map((rec) => (
                    <tr key={rec.id} className="border-t border-border hover:bg-canvas-soft">
                      <td className="px-4 py-3 text-foreground">
                        {rec.staff?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(rec.salary_period_start), "dd MMM")} –{" "}
                        {format(new Date(rec.salary_period_end), "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {money(rec.base_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {money(rec.commission_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {money(rec.bonus)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {money(rec.deductions)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">
                        {money(rec.total_paid)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={rec.status === "paid" ? "active" : "pending"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Salary configuration */}
      <Dialog open={!!configFor} onOpenChange={(o) => !o && setConfigFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salary — {configFor?.full_name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitConfig(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="salary_type">Salary type</Label>
              <select
                id="salary_type"
                name="salary_type"
                defaultValue={configFor?.payroll?.salary_type ?? "fixed"}
                className="w-full mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="fixed">Fixed salary</option>
                <option value="commission">Commission only</option>
                <option value="hybrid">Hybrid (base + commission)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="base_salary">Base salary ({CURRENCY})</Label>
                <Input
                  id="base_salary"
                  name="base_salary"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={configFor?.payroll?.base_salary ?? 0}
                />
              </div>
              <div>
                <Label htmlFor="commission_percentage">Commission %</Label>
                <Input
                  id="commission_percentage"
                  name="commission_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={configFor?.payroll?.commission_percentage ?? 0}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="session_rate">PT session rate ({CURRENCY})</Label>
              <Input
                id="session_rate"
                name="session_rate"
                type="number"
                min="0"
                step="0.01"
                placeholder="500"
                defaultValue={configFor?.payroll?.session_rate ?? ""}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Commission accrues when a personal-training session is marked complete,
              calculated as this percentage of the PT session rate. Leave the rate blank
              to use the platform default of {CURRENCY}500.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfigFor(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                disabled={upsertConfig.isPending}
              >
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Run payroll */}
      <Dialog open={!!runFor} onOpenChange={(o) => !o && setRunFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run payroll — {runFor?.full_name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRun(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">Period start</Label>
                <Input
                  id="start"
                  name="start"
                  type="date"
                  required
                  defaultValue={format(startOfMonth(new Date()), "yyyy-MM-dd")}
                />
              </div>
              <div>
                <Label htmlFor="end">Period end</Label>
                <Input
                  id="end"
                  name="end"
                  type="date"
                  required
                  defaultValue={format(endOfMonth(new Date()), "yyyy-MM-dd")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bonus">Bonus ({CURRENCY})</Label>
                <Input id="bonus" name="bonus" type="number" min="0" step="0.01" defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="deductions">Deductions ({CURRENCY})</Label>
                <Input
                  id="deductions"
                  name="deductions"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={0}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" placeholder="Reference, adjustments…" />
            </div>
            <p className="text-xs text-muted-foreground">
              Commission is summed from completed PT sessions in the period. A record
              already exists for a period cannot be created twice.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRunFor(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                disabled={processPayroll.isPending}
              >
                {processPayroll.isPending ? "Processing…" : "Process payroll"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
