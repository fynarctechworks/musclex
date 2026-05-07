"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DateRangePreset = "today" | "this_week" | "this_month" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

export interface DashboardFilterState {
  branchId: string | null;
  dateRange: DateRange;
  planTypes: string[];
  trainerIds: string[];
}

export interface DashboardFilterContextValue extends DashboardFilterState {
  setBranchId: (id: string | null) => void;
  setDateRange: (range: DateRange) => void;
  setPlanTypes: (ids: string[]) => void;
  setTrainerIds: (ids: string[]) => void;
  setDatePreset: (preset: DateRangePreset) => void;
  resetFilters: () => void;
}

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(
  null,
);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Compute the [from, to] range for a given preset.
 * Custom presets fall back to "today" until the user picks dates explicitly.
 */
export function rangeForPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  if (preset === "today") {
    return { from: startOfDay(now), to: endOfDay(now), preset };
  }
  if (preset === "this_week") {
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    const offset = day === 0 ? -6 : 1 - day;
    monday.setDate(now.getDate() + offset);
    return { from: startOfDay(monday), to: endOfDay(now), preset };
  }
  if (preset === "this_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(first), to: endOfDay(now), preset };
  }
  return { from: startOfDay(now), to: endOfDay(now), preset: "custom" };
}

interface ProviderProps {
  initialBranchId?: string | null;
  children: ReactNode;
}

/**
 * Wraps the dashboard page so every tile reads filters from one place.
 * No tile should ever take a filter as a prop — they consume this context.
 */
export function DashboardFilterProvider({
  initialBranchId = null,
  children,
}: ProviderProps) {
  const [branchId, setBranchId] = useState<string | null>(initialBranchId);
  const [dateRange, setDateRange] = useState<DateRange>(rangeForPreset("today"));
  const [planTypes, setPlanTypes] = useState<string[]>([]);
  const [trainerIds, setTrainerIds] = useState<string[]>([]);

  const setDatePreset = useCallback((preset: DateRangePreset) => {
    setDateRange(rangeForPreset(preset));
  }, []);

  const resetFilters = useCallback(() => {
    setBranchId(initialBranchId);
    setDateRange(rangeForPreset("today"));
    setPlanTypes([]);
    setTrainerIds([]);
  }, [initialBranchId]);

  const value = useMemo<DashboardFilterContextValue>(
    () => ({
      branchId,
      dateRange,
      planTypes,
      trainerIds,
      setBranchId,
      setDateRange,
      setPlanTypes,
      setTrainerIds,
      setDatePreset,
      resetFilters,
    }),
    [branchId, dateRange, planTypes, trainerIds, setDatePreset, resetFilters],
  );

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters(): DashboardFilterContextValue {
  const ctx = useContext(DashboardFilterContext);
  if (!ctx) {
    throw new Error(
      "useDashboardFilters must be used inside <DashboardFilterProvider>",
    );
  }
  return ctx;
}
