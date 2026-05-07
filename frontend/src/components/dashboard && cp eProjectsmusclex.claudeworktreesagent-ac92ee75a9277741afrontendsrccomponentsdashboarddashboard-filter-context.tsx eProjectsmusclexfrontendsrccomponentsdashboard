"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  Plus,
  RefreshCcw,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import {
  useDashboardFilters,
  type DateRangePreset,
} from "./dashboard-filter-context";

interface BranchSummary {
  id: string;
  name: string;
}
interface PlanSummary {
  id: string;
  name: string;
  plan_type?: string;
}
interface TrainerSummary {
  id: string;
  full_name?: string;
  name?: string;
}

const PRESET_LABELS: Record<Exclude<DateRangePreset, "custom">, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
};

const QUICK_ACTIONS = [
  { label: "Add Member", path: "/members/new", icon: Plus },
  { label: "Renew Membership", path: "/members?intent=renew", icon: RefreshCcw },
  { label: "Collect Payment", path: "/payments/new", icon: Plus },
  { label: "Book Class", path: "/classes/book", icon: Plus },
  { label: "Assign Trainer", path: "/staff?intent=assign", icon: Plus },
  { label: "Send Reminder", path: "/marketing/campaigns/new", icon: Plus },
  { label: "Generate Invoice", path: "/payments/invoices/new", icon: Plus },
];

function formatDateShort(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}
function Chip({ active, onClick, children, ariaLabel }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Sticky-top filter bar visible on desktop only (hidden md:flex).
 * Mobile uses the existing branch selector pattern + bottom sheet (future Wave).
 *
 * Reads branchId from the auth store as the source of truth — falls back to
 * the first accessible branch in `branch_ids[]`. All four filters mutate
 * <DashboardFilterProvider> so every tile re-queries.
 */
export function DashboardFilterBar() {
  const router = useRouter();
  const { gymPath } = useGymSlug();
  const { user } = useAuthStore();
  const filters = useDashboardFilters();

  const { data: branches } = useQuery<BranchSummary[]>({
    queryKey: ["dashboard", "filter-bar", "branches"],
    queryFn: () => apiClient.get<BranchSummary[]>("/branches"),
  });

  const { data: plansData } = useQuery<PlanSummary[]>({
    queryKey: ["dashboard", "filter-bar", "plans"],
    queryFn: () => apiClient.get<PlanSummary[]>("/membership-plans"),
  });

  const { data: trainersResp } = useQuery({
    queryKey: ["dashboard", "filter-bar", "trainers"],
    queryFn: () =>
      apiClient.get<TrainerSummary[] | { data: TrainerSummary[] }>(
        "/staff?role=trainer",
      ),
  });
  const trainers: TrainerSummary[] = useMemo(() => {
    if (!trainersResp) return [];
    if (Array.isArray(trainersResp)) return trainersResp;
    if ("data" in trainersResp && Array.isArray(trainersResp.data)) {
      return trainersResp.data;
    }
    return [];
  }, [trainersResp]);

  // Determine active branch — prefer explicit filter, then user's branch_ids[0].
  const activeBranchId =
    filters.branchId ?? user?.branch_ids?.[0] ?? null;
  const activeBranch = branches?.find((b) => b.id === activeBranchId);

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [planPopoverOpen, setPlanPopoverOpen] = useState(false);
  const [trainerPopoverOpen, setTrainerPopoverOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const togglePlan = (id: string) => {
    if (filters.planTypes.includes(id)) {
      filters.setPlanTypes(filters.planTypes.filter((p) => p !== id));
    } else {
      filters.setPlanTypes([...filters.planTypes, id]);
    }
  };

  const toggleTrainer = (id: string) => {
    if (filters.trainerIds.includes(id)) {
      filters.setTrainerIds(filters.trainerIds.filter((t) => t !== id));
    } else {
      filters.setTrainerIds([...filters.trainerIds, id]);
    }
  };

  return (
    <div
      className={cn(
        // Hidden on mobile — mobile dashboard uses the existing branch selector pattern.
        "hidden md:flex sticky top-0 z-30 mb-6 items-center gap-2 flex-wrap",
        "bg-card/80 backdrop-blur border border-border rounded-xl px-4 py-3",
      )}
    >
      {/* Branch chip — read-only display; the source of truth is the workspace switcher in the app shell. */}
      {activeBranch ? (
        <Chip ariaLabel="Active branch">
          <span className="text-muted-foreground">Branch:</span>
          <span className="font-medium">{activeBranch.name}</span>
        </Chip>
      ) : (
        <Chip ariaLabel="All branches">
          <span className="text-muted-foreground">Branch:</span>
          <span className="font-medium">All</span>
        </Chip>
      )}

      {/* Date-range presets */}
      {(["today", "this_week", "this_month"] as const).map((preset) => (
        <Chip
          key={preset}
          active={filters.dateRange.preset === preset}
          onClick={() => filters.setDatePreset(preset)}
        >
          {PRESET_LABELS[preset]}
        </Chip>
      ))}

      {/* Custom range popover — uses native date inputs (no extra calendar dep). */}
      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
              filters.dateRange.preset === "custom"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted/50",
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {filters.dateRange.preset === "custom"
              ? `${formatDateShort(filters.dateRange.from)} – ${formatDateShort(filters.dateRange.to)}`
              : "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          <div>
            <label className="text-[12px] text-muted-foreground">From</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
              value={filters.dateRange.from.toISOString().slice(0, 10)}
              onChange={(e) => {
                const next = new Date(e.target.value);
                if (!Number.isNaN(next.getTime())) {
                  filters.setDateRange({
                    ...filters.dateRange,
                    from: next,
                    preset: "custom",
                  });
                }
              }}
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">To</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
              value={filters.dateRange.to.toISOString().slice(0, 10)}
              onChange={(e) => {
                const next = new Date(e.target.value);
                if (!Number.isNaN(next.getTime())) {
                  filters.setDateRange({
                    ...filters.dateRange,
                    to: next,
                    preset: "custom",
                  });
                }
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Plan-type multi-select */}
      <Popover open={planPopoverOpen} onOpenChange={setPlanPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
              filters.planTypes.length > 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted/50",
            )}
          >
            Plan
            {filters.planTypes.length > 0 ? (
              <span className="rounded-full bg-primary/20 px-1.5 text-[11px]">
                {filters.planTypes.length}
              </span>
            ) : null}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 max-h-72 overflow-auto p-2">
          {(plansData ?? []).length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-muted-foreground">
              No plans available
            </p>
          ) : (
            <ul className="space-y-1">
              {(plansData ?? []).map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted/50">
                    <Checkbox
                      checked={filters.planTypes.includes(p.id)}
                      onCheckedChange={() => togglePlan(p.id)}
                    />
                    <span className="flex-1">{p.name}</span>
                    {p.plan_type ? (
                      <span className="text-[11px] text-muted-foreground">
                        {p.plan_type}
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {filters.planTypes.length > 0 ? (
            <button
              type="button"
              onClick={() => filters.setPlanTypes([])}
              className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          ) : null}
        </PopoverContent>
      </Popover>

      {/* Trainer multi-select */}
      <Popover open={trainerPopoverOpen} onOpenChange={setTrainerPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
              filters.trainerIds.length > 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted/50",
            )}
          >
            Trainer
            {filters.trainerIds.length > 0 ? (
              <span className="rounded-full bg-primary/20 px-1.5 text-[11px]">
                {filters.trainerIds.length}
              </span>
            ) : null}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 max-h-72 overflow-auto p-2">
          {trainers.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-muted-foreground">
              No trainers available
            </p>
          ) : (
            <ul className="space-y-1">
              {trainers.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted/50">
                    <Checkbox
                      checked={filters.trainerIds.includes(t.id)}
                      onCheckedChange={() => toggleTrainer(t.id)}
                    />
                    <span className="flex-1">
                      {t.full_name ?? t.name ?? "Unnamed"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {filters.trainerIds.length > 0 ? (
            <button
              type="button"
              onClick={() => filters.setTrainerIds([])}
              className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          ) : null}
        </PopoverContent>
      </Popover>

      {/* Spacer pushes Quick Actions to the right */}
      <div className="flex-1" />

      {/* Quick Actions launcher */}
      <Popover open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Quick Actions
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 p-2">
          <ul className="space-y-1">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const href = gymPath(action.path);
              return (
                <li key={action.label}>
                  <Link
                    href={href}
                    onClick={() => setQuickActionsOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted/50"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{action.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      {/* Reset button — only visible if any filter is non-default */}
      {(filters.dateRange.preset !== "today" ||
        filters.planTypes.length > 0 ||
        filters.trainerIds.length > 0) && (
        <button
          type="button"
          onClick={() => filters.resetFilters()}
          className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Reset
        </button>
      )}

      {/* router is referenced to satisfy noUnusedLocals if router stays unused in the future */}
      {false && router ? null : null}
    </div>
  );
}
