import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '../../node_modules/.prisma/client-tenant';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import {
  CreateBundleDto,
  UpdateBundleDto,
  BundleComponentDto,
} from './dto';
import { getTenantGymId } from '../common/tenant-context';

type Tx = Prisma.TransactionClient;

/**
 * Shape returned by buildSaleLines() — one row per bundle component, ready to
 * be inserted as PosSaleItem rows with the bundle_id grouping them.
 */
export interface BundleSaleLine {
  product_id: string;
  product_name: string;
  track_batches: boolean;
  quantity: number;
  unit_price: number; // proportional split of bundle price
  tax_rate: number;   // inherited from bundle.tax_rate
  tax_amount: number;
  total_price: number;
}

@Injectable()
export class BundleService {
  constructor(private tenant: TenantPrisma) {}

  // ── CRUD ──────────────────────────────────────────────────────

  async create(dto: CreateBundleDto) {
    // Validate components — products exist + no dupes (the @@unique would error
    // anyway, but a clean message beats a Prisma constraint error).
    const productIds = dto.items.map((i) => i.product_id);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('A product can only appear once per bundle');
    }
    const products = await this.tenant.client.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more component products not found');
    }
    if (dto.sku) {
      const dup = await this.tenant.client.bundle.findFirst({ where: { sku: dto.sku } });
      if (dup) throw new ConflictException('Bundle SKU already exists in this gym');
    }

    const gymId = getTenantGymId()!;
    return this.tenant.client.bundle.create({
      data: {
        gym_id: gymId,
        organization_id: dto.organization_id,
        branch_id: dto.branch_id,
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        price: dto.price,
        tax_rate: dto.tax_rate ?? 0,
        image_url: dto.image_url,
        items: {
          create: dto.items.map((i) => ({
            gym_id: gymId,
            product_id: i.product_id,
            quantity: i.quantity,
          })),
        },
      },
      include: this.bundleInclude(),
    });
  }

  async findAll(filters: {
    branch_id?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, status, search, page = 1, limit = 50 } = filters;
    const safeLimit = Math.min(limit, 200);
    const skip = (page - 1) * safeLimit;
    const where: any = {};
    if (status) where.status = status;
    if (branch_id) {
      // Branch-scoped: show bundles for this branch OR shared (branch_id IS NULL).
      where.OR = [{ branch_id }, { branch_id: null }];
    }
    if (search) {
      where.AND = [{
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }];
    }

    const [data, total] = await Promise.all([
      this.tenant.client.bundle.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { name: 'asc' },
        include: this.bundleInclude(),
      }),
      this.tenant.client.bundle.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const bundle = await this.tenant.client.bundle.findUnique({
      where: { id },
      include: this.bundleInclude(),
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return bundle;
  }

  async update(id: string, dto: UpdateBundleDto) {
    const existing = await this.tenant.client.bundle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bundle not found');
    if (dto.sku && dto.sku !== existing.sku) {
      const dup = await this.tenant.client.bundle.findFirst({ where: { sku: dto.sku } });
      if (dup) throw new ConflictException('Bundle SKU already exists in this gym');
    }

    return this.tenant.client.$transaction(async (tx) => {
      if (dto.items) {
        const productIds = dto.items.map((i) => i.product_id);
        if (new Set(productIds).size !== productIds.length) {
          throw new BadRequestException('A product can only appear once per bundle');
        }
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true },
        });
        if (products.length !== productIds.length) {
          throw new BadRequestException('One or more component products not found');
        }
        await tx.bundleItem.deleteMany({ where: { bundle_id: id } });
        await tx.bundleItem.createMany({
          data: dto.items.map((i) => ({
            gym_id: getTenantGymId()!,
            bundle_id: id,
            product_id: i.product_id,
            quantity: i.quantity,
          })),
        });
      }
      const { items: _items, ...rest } = dto;
      return tx.bundle.update({
        where: { id },
        data: rest,
        include: this.bundleInclude(),
      });
    });
  }

  async remove(id: string) {
    const existing = await this.tenant.client.bundle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bundle not found');
    // Soft delete via status — keeps historical sale references intact.
    return this.tenant.client.bundle.update({
      where: { id },
      data: { status: 'discontinued' },
    });
  }

  // ── Used by POS ───────────────────────────────────────────────

  /**
   * Checks that every component has enough stock at the selling branch (multiplied
   * by `bundleQty`). For batch-tracked components, only non-expired stock counts.
   * Throws BadRequestException with a friendly message if any component falls short.
   * Reads use the live Prisma client, not a tx — POS calls this for the pre-tx
   * fail-fast; the in-tx FIFO decrement still re-validates atomically.
   */
  async checkAvailability(bundleId: string, branchId: string, bundleQty: number) {
    const bundle = await this.findOne(bundleId);
    if (bundle.status !== 'active') {
      throw new BadRequestException(`Bundle "${bundle.name}" is not active`);
    }

    const shortfalls: string[] = [];
    for (const item of bundle.items) {
      const needed = item.quantity * bundleQty;
      if (item.product.track_batches) {
        // Sum non-expired batches at this branch.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const batches = await this.tenant.client.productBatch.findMany({
          where: {
            product_id: item.product_id,
            branch_id: branchId,
            status: 'active',
            quantity: { gt: 0 },
            OR: [{ expiry_date: null }, { expiry_date: { gte: today } }],
          },
          select: { quantity: true },
        });
        const usable = batches.reduce((s, b) => s + b.quantity, 0);
        if (usable < needed) {
          shortfalls.push(`${item.product.product_name}: need ${needed}, have ${usable} non-expired`);
        }
      } else {
        const inv = await this.tenant.client.inventory.findUnique({
          where: { product_id_branch_id: { product_id: item.product_id, branch_id: branchId } },
          select: { stock_quantity: true },
        });
        const have = inv?.stock_quantity ?? 0;
        if (have < needed) {
          shortfalls.push(`${item.product.product_name}: need ${needed}, have ${have}`);
        }
      }
    }
    if (shortfalls.length > 0) {
      throw new BadRequestException(
        `Cannot sell bundle "${bundle.name}" at this branch — ${shortfalls.join('; ')}`,
      );
    }
    return bundle;
  }

  /**
   * Builds the per-component PosSaleItem lines for selling `bundleQty` of a bundle.
   * Revenue is split proportionally by each component's list price (component.price *
   * component.quantity-in-bundle). The sum of split unit_prices equals the bundle
   * unit price (penny-perfect; the LARGEST component absorbs the rounding residual).
   * Tax is recomputed per component from the split price using the bundle's tax_rate.
   */
  async buildSaleLines(bundleId: string, bundleQty: number): Promise<{
    bundle: Awaited<ReturnType<BundleService['findOne']>>;
    lines: BundleSaleLine[];
    lineSubtotal: number;
    lineTax: number;
    lineTotal: number;
  }> {
    const bundle = await this.findOne(bundleId);
    const taxRate = Number(bundle.tax_rate);
    const bundleUnit = Number(bundle.price);

    // Weight each component by (list price * quantity in bundle). Zero-price
    // components still receive at least 1 cent if the bundle has any revenue;
    // if the bundle is free (price=0), every line is zero.
    const weights = bundle.items.map((it) => ({
      item: it,
      weight: Number(it.product.price) * it.quantity,
    }));
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);

    // Split bundleUnit price across components by weight, round to 2dp, then
    // adjust the largest component for the rounding residual.
    const splits = weights.map((w) => {
      const share = totalWeight > 0 ? (w.weight / totalWeight) * bundleUnit : bundleUnit / weights.length;
      return { item: w.item, unitForOneBundle: Math.round(share * 100) / 100 };
    });
    const splitSum = splits.reduce((s, x) => s + x.unitForOneBundle, 0);
    const residual = Math.round((bundleUnit - splitSum) * 100) / 100;
    if (residual !== 0 && splits.length > 0) {
      // Apply residual to the component with the largest weight (most stable).
      let idx = 0;
      for (let i = 1; i < splits.length; i++) {
        if (weights[i].weight > weights[idx].weight) idx = i;
      }
      splits[idx].unitForOneBundle = Math.round((splits[idx].unitForOneBundle + residual) * 100) / 100;
    }

    const lines: BundleSaleLine[] = splits.map(({ item, unitForOneBundle }) => {
      const componentQty = item.quantity * bundleQty;
      const unitPrice = unitForOneBundle / item.quantity; // per-unit-of-component
      const lineSubtotal = unitForOneBundle * bundleQty; // = unitPrice * componentQty
      const lineTaxAmt = lineSubtotal * (taxRate / 100);
      return {
        product_id: item.product_id,
        product_name: item.product.product_name,
        track_batches: item.product.track_batches,
        quantity: componentQty,
        unit_price: Math.round(unitPrice * 100) / 100,
        tax_rate: taxRate,
        tax_amount: Math.round(lineTaxAmt * 100) / 100,
        total_price: Math.round((lineSubtotal + lineTaxAmt) * 100) / 100,
      };
    });

    const lineSubtotal = bundleUnit * bundleQty;
    const lineTax = Math.round(lineSubtotal * (taxRate / 100) * 100) / 100;
    return { bundle, lines, lineSubtotal, lineTax, lineTotal: lineSubtotal + lineTax };
  }

  // ── internal ──────────────────────────────────────────────────

  private bundleInclude() {
    return {
      items: {
        include: {
          product: {
            select: {
              id: true,
              product_name: true,
              sku: true,
              price: true,
              tax_rate: true,
              track_batches: true,
            },
          },
        },
        orderBy: { created_at: 'asc' as const },
      },
      branch: { select: { id: true, name: true } },
    };
  }
}
