"use client";

/**
 * Wave 13 — Inventory Dashboard Tile.
 *
 * Renders up to 4 category rows (most-stocked first) with item counts,
 * low-stock badge (clickable → /products?category), 30d sales count, 30d
 * revenue. Below the table, a compact list of the worst low-stock items.
 *
 * Backend may return `note` if the inventory module is not enabled — we
 * surface an empty state rather than failing.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { Boxes, ArrowRight, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import type { InventoryDashboard } from "@/lib/types";

interface InventoryTileProps {
  branchId?: string;
}

export function InventoryTile({ branchId }: InventoryTileProps) {
  const { gymPath } = useGymSlug();

  const { data, isLoading } = useQuery<InventoryDashboard>({
    queryKey: queryKeys.dashboard.inventory(branchId),
    queryFn: () =>
      apiClient.get(
        `/dashboard/inventory${branchId ? `?branch_id=${branchId}` : ""}`,
      ),
    staleTime: 30_000,
  });

  const topCategories = useMemo(() => {
    if (!data) return [];
    return [...data.categories]
      .sort((a, b) => b.items_count - a.items_count)
      .slice(0, 4);
  }, [data]);

  const noModule = !!data?.note;
  const isEmpty = !isLoading && (noModule || (data?.categories.length ?? 0) === 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Boxes className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold leading-tight text-foreground truncate">
              Inventory
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
              Stock levels &amp; 30-day sales by category
            </p>
          </div>
        </div>
        <Link
          href={gymPath("/inventory")}
          className="shrink-0 text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 mt-1.5"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && isEmpty && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="rounded-full bg-muted/40 p-3">
            <Boxes className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-[13px] font-medium text-foreground">
            {data?.note ? "Inventory module not enabled" : "No products tracked yet"}
          </p>
          <p className="text-[12px] text-muted-foreground max-w-[260px]">
            {data?.note
              ? "Set up products and stock levels in the Inventory module to see this tile populate."
              : "Add your first product to start tracking stock and sales."}
          </p>
          <Link
            href={gymPath("/inventory")}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80"
          >
            Go to Inventory <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {!isLoading && !isEmpty && (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium py-2 px-3">Category</th>
                  <th className="text-right font-medium py-2 px-3">Items</th>
                  <th className="text-right font-medium py-2 px-3">Low</th>
                  <th className="text-right font-medium py-2 px-3">30d Sold</th>
                  <th className="text-right font-medium py-2 px-3">30d Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topCategories.map((cat) => {
                  const drillHref = gymPath(
                    `/inventory?category=${encodeURIComponent(cat.category)}`,
                  );
                  const lowTotal = cat.low_stock + cat.out_of_stock;
                  return (
                    <tr
                      key={cat.category_id ?? cat.category}
                      className="border-t border-border hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2 px-3 text-foreground">
                        <Link href={drillHref} className="hover:underline">
                          {cat.category}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {cat.items_count}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {lowTotal > 0 ? (
                          <Link
                            href={drillHref}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                            style={{
                              backgroundColor: "hsl(var(--destructive) / 0.12)",
                              color: "hsl(var(--destructive))",
                            }}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {lowTotal}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {cat.sales_30d_count}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">
                        ₹{cat.sales_30d_amount.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data && data.low_stock_items.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-medium text-foreground">
                  Restock soon
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {data.total_low_stock_count} item
                  {data.total_low_stock_count === 1 ? "" : "s"} low
                </span>
              </div>
              <ul className="space-y-1.5">
                {data.low_stock_items.slice(0, 4).map((item) => (
                  <li
                    key={`${item.product_id}-${item.branch_id}`}
                    className="flex items-center justify-between text-[12px]"
                  >
                    <Link
                      href={gymPath(`/inventory?product=${item.product_id}`)}
                      className="text-foreground hover:underline truncate max-w-[60%]"
                    >
                      {item.product_name}
                      {item.sku ? (
                        <span className="text-muted-foreground"> · {item.sku}</span>
                      ) : null}
                    </Link>
                    <span
                      className="font-medium"
                      style={{
                        color:
                          item.stock_quantity === 0
                            ? "hsl(var(--destructive))"
                            : "hsl(var(--warning))",
                      }}
                    >
                      {item.stock_quantity} / {item.reorder_level}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
