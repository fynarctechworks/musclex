"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export type LayoutTile = {
  id: string;
  visible: boolean;
  size: 1 | 2 | 3;
  order: number;
};

export interface DashboardLayout {
  tiles: LayoutTile[];
  version: number;
  is_default: boolean;
}

const KEY = ["dashboard", "layout"] as const;

export function useDashboardLayout() {
  const qc = useQueryClient();

  const query = useQuery<DashboardLayout>({
    queryKey: KEY,
    queryFn: () => apiClient.get("/dashboard/layout"),
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (tiles: LayoutTile[]) =>
      apiClient.post("/dashboard/layout", { tiles }),
    onSuccess: () => {
      toast.success("Dashboard layout saved");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: () => toast.error("Could not save layout"),
  });

  const reset = useMutation({
    mutationFn: () => apiClient.post("/dashboard/layout/reset"),
    onSuccess: () => {
      toast.success("Layout reset to default");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: () => toast.error("Could not reset layout"),
  });

  return {
    layout: query.data,
    isLoading: query.isLoading,
    save: save.mutate,
    saving: save.isPending,
    reset: reset.mutate,
    resetting: reset.isPending,
  };
}
