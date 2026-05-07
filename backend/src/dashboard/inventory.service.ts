import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';

/**
 * Prisma error codes the inventory tile treats as "module not enabled":
 *   P2021 — table does not exist in DB (migration not run, or feature off)
 *   P2022 — column does not exist (older schema)
 * Anything else is a real error and must propagate.
 */
const TABLE_OR_COLUMN_MISSING = new Set(['P2021', 'P2022']);

export interface InventoryCategoryRow {
  category_id: string | null;
  category: string;
  items_count: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  value_in_stock: number;
  sales_30d_count: number;
  sales_30d_amount: number;
}

export interface LowStockItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  category: string;
  branch_id: string;
  branch_name: string | null;
  stock_quantity: number;
  reorder_level: number;
  shortfall: number;
}

export interface InventoryDashboardResponse {
  categories: InventoryCategoryRow[];
  low_stock_items: LowStockItem[];
  total_value_in_stock: number;
  total_low_stock_count: number;
  generated_at: string;
  note?: string;
}

interface CacheEntry {
  value: InventoryDashboardResponse;
  expires_at: number;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class DashboardInventoryService {
  private readonly logger = new Logger(DashboardInventoryService.name);
  private cache = new Map<string, CacheEntry>();

  constructor(private prisma: PrismaService) {}

  async getInventory(
    user: JwtPayload,
    branchId?: string,
  ): Promise<InventoryDashboardResponse> {
    const cacheKey = `${user?.studio_id ?? 'global'}:${branchId ?? 'all'}:${user?.role ?? 'unknown'}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires_at > now) {
      return cached.value;
    }

    try {
      const value = await this.compute(user, branchId);
      this.cache.set(cacheKey, { value, expires_at: now + CACHE_TTL_MS });
      return value;
    } catch (err) {
      // Only swallow "table/column doesn't exist" — those legitimately mean
      // the inventory module isn't wired up yet. Connection failures, query
      // syntax bugs, permission errors, etc. must surface to the operator.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        TABLE_OR_COLUMN_MISSING.has(err.code)
      ) {
        this.logger.warn(
          `Inventory schema not available (${err.code}) — returning empty stub`,
        );
        return {
          categories: [],
          low_stock_items: [],
          total_value_in_stock: 0,
          total_low_stock_count: 0,
          generated_at: new Date().toISOString(),
          note: 'Inventory module not enabled',
        };
      }
      this.logger.error(
        `Inventory dashboard query failed: ${(err as Error)?.message ?? err}`,
        (err as Error)?.stack,
      );
      throw err;
    }
  }

  private async compute(
    user: JwtPayload,
    branchId?: string,
  ): Promise<InventoryDashboardResponse> {
    const allowedBranchIds = this.resolveBranchIds(user, branchId);

    // Pull products with category and per-branch inventory rows
    // (Inventory is per (product, branch); a product without a branch has no inventory row.)
    const products = await this.prisma.product.findMany({
      where: {
        ...(allowedBranchIds === null
          ? {}
          : { branch_id: { in: allowedBranchIds } }),
        status: { not: 'discontinued' },
      },
      select: {
        id: true,
        product_name: true,
        sku: true,
        price: true,
        cost_price: true,
        category_id: true,
        category: { select: { id: true, name: true } },
        branch_id: true,
        branch: { select: { id: true, name: true } },
        inventory: {
          select: {
            stock_quantity: true,
            reserved_quantity: true,
            reorder_level: true,
          },
        },
      },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    // Sales aggregates (last 30 days), grouped by product
    const saleItems = await this.prisma.posSaleItem.findMany({
      where: {
        sale: {
          status: { in: ['completed', 'partial_refund'] },
          created_at: { gte: thirtyDaysAgo },
          ...(allowedBranchIds === null
            ? {}
            : { branch_id: { in: allowedBranchIds } }),
        },
      },
      select: {
        product_id: true,
        quantity: true,
        total_price: true,
      },
    });

    const salesByProduct = new Map<string, { count: number; amount: number }>();
    for (const it of saleItems) {
      const cur = salesByProduct.get(it.product_id) ?? { count: 0, amount: 0 };
      cur.count += it.quantity;
      cur.amount += Number(it.total_price ?? 0);
      salesByProduct.set(it.product_id, cur);
    }

    // Bucket per category
    const categoryMap = new Map<string, InventoryCategoryRow>();
    const lowStock: LowStockItem[] = [];
    let totalValueInStock = 0;

    for (const p of products) {
      const catKey = p.category?.id ?? '__uncategorised';
      const catName = p.category?.name ?? 'Uncategorised';
      const inv = p.inventory;
      const qty = inv?.stock_quantity ?? 0;
      const reorder = inv?.reorder_level ?? 0;
      const cost = Number(p.cost_price ?? 0);
      const valueAtCost = qty * cost;
      totalValueInStock += valueAtCost;

      const sales = salesByProduct.get(p.id) ?? { count: 0, amount: 0 };

      let row = categoryMap.get(catKey);
      if (!row) {
        row = {
          category_id: p.category?.id ?? null,
          category: catName,
          items_count: 0,
          in_stock: 0,
          low_stock: 0,
          out_of_stock: 0,
          value_in_stock: 0,
          sales_30d_count: 0,
          sales_30d_amount: 0,
        };
        categoryMap.set(catKey, row);
      }
      row.items_count += 1;
      row.value_in_stock += valueAtCost;
      row.sales_30d_count += sales.count;
      row.sales_30d_amount += sales.amount;

      if (qty === 0) {
        row.out_of_stock += 1;
      } else if (reorder > 0 && qty <= reorder) {
        row.low_stock += 1;
      } else {
        row.in_stock += 1;
      }

      if (inv && (qty === 0 || (reorder > 0 && qty <= reorder))) {
        lowStock.push({
          product_id: p.id,
          product_name: p.product_name,
          sku: p.sku,
          category: catName,
          branch_id: p.branch_id ?? '',
          branch_name: p.branch?.name ?? null,
          stock_quantity: qty,
          reorder_level: reorder,
          shortfall: Math.max(reorder - qty, qty === 0 ? 1 : 0),
        });
      }
    }

    // Sort: out_of_stock first (qty=0), then by largest shortfall
    lowStock.sort((a, b) => {
      if ((a.stock_quantity === 0) !== (b.stock_quantity === 0)) {
        return a.stock_quantity === 0 ? -1 : 1;
      }
      return b.shortfall - a.shortfall;
    });

    const categories = Array.from(categoryMap.values()).sort((a, b) =>
      a.category.localeCompare(b.category),
    );

    return {
      categories,
      low_stock_items: lowStock.slice(0, 25),
      total_value_in_stock: Math.round(totalValueInStock * 100) / 100,
      total_low_stock_count: lowStock.length,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Returns null = no branch filter (owner viewing all),
   * or a list of branch ids to scope by.
   */
  private resolveBranchIds(user?: JwtPayload, branchId?: string): string[] | null {
    if (branchId) return [branchId];
    if (!user || user.role === 'owner') return null;
    if (user.branch_ids?.length > 0) return user.branch_ids;
    return [];
  }
}
