"use client";

import { useEffect, useState } from "react";
import { Settings, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDashboardLayout, type LayoutTile } from "@/hooks/use-dashboard-layout";

const TILE_LABELS: Record<string, string> = {
  revenue_trend: "Revenue Trend",
  recent_activity: "Recent Activity",
  occupancy_gauge: "Live Occupancy",
  todays_classes: "Today's Classes",
  revenue_mix: "Revenue Mix",
  payment_methods: "Payment Methods",
  revenue_summary: "Revenue Summary",
  retention_curve: "Cohort Retention",
  segments: "Member Segments",
  business_metrics: "Business Metrics",
  footfall_heatmap: "Footfall Heatmap",
  inventory: "Inventory",
  trainer_leaderboard: "Trainer Leaderboard",
};

/**
 * Wave 14 — Dashboard Customizer.
 *
 * Drawer UI for show/hide + reorder + size selection of working-canvas tiles.
 * The Pulse Strip and Action Stack are not customizable — they are sacred per
 * the dashboard upgrade plan §3.1.
 */
export function DashboardCustomizer() {
  const { layout, save, saving, reset, resetting } = useDashboardLayout();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LayoutTile[]>([]);

  useEffect(() => {
    if (layout?.tiles && open) setDraft(layout.tiles);
  }, [layout, open]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...draft];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setDraft(next.map((t, i) => ({ ...t, order: i })));
  };

  const toggle = (idx: number) => {
    const next = [...draft];
    next[idx] = { ...next[idx], visible: !next[idx].visible };
    setDraft(next);
  };

  const setSize = (idx: number, size: 1 | 2 | 3) => {
    const next = [...draft];
    next[idx] = { ...next[idx], size };
    setDraft(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Customize
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Customize Dashboard</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-4">
          {draft.map((tile, idx) => (
            <div
              key={tile.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === draft.length - 1}
                  aria-label="Move down"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  {TILE_LABELS[tile.id] ?? tile.id}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(idx, s as 1 | 2 | 3)}
                      className={`px-1.5 py-0.5 text-[10px] rounded ${
                        tile.size === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                      aria-label={`Size ${s} columns`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <Switch
                checked={tile.visible}
                onCheckedChange={() => toggle(idx)}
                aria-label={`Show ${TILE_LABELS[tile.id] ?? tile.id}`}
              />
            </div>
          ))}
        </div>

        <SheetFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => reset()}
            disabled={resetting}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={() => {
              save(draft);
              setOpen(false);
            }}
            disabled={saving}
            className="flex-1"
          >
            {saving ? "Saving…" : "Save layout"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
