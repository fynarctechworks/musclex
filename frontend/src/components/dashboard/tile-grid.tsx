"use client";

import type { ReactNode, ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface TileSpec {
  /** Stable id from the backend tile registry. */
  id: string;
  /** Component reference rendered as the tile body. Receives no props by default. */
  Component: ComponentType;
}

interface TileGridProps {
  tiles?: TileSpec[];
  children?: ReactNode;
  className?: string;
}

/**
 * 12-column responsive tile grid:
 *   mobile: 1 col, tablet: 2 cols, desktop: 3 cols.
 * Tile width is controlled by each tile (via TileCard `size`), not by the grid.
 *
 * Either pass `tiles` (registry-driven) or pass `<TileCard>` children directly.
 */
export function TileGrid({ tiles, children, className }: TileGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
        className,
      )}
    >
      {tiles?.map(({ id, Component }) => <Component key={id} />)}
      {children}
    </div>
  );
}
