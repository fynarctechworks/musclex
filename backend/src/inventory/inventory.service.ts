import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  AdjustInventoryDto,
  UpdateReorderLevelDto,
} from './dto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ── Product Categories ────────────────────────────────────────

  async createCategory(dto: CreateProductCategoryDto) {
    return this.prisma.productCategory.create({
      data: { ...dto, gym_id: getTenantGymId()! },
    });
  }

  async findAllCategories(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.organization_id = organizationId;
    return this.prisma.productCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async updateCategory(id: string, dto: UpdateProductCategoryDto) {
    const cat = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  // ── Products ──────────────────────────────────────────────────

  async createProduct(dto: CreateProductDto) {
    if (dto.sku) {
      const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existing) throw new ConflictException('SKU already exists');
    }
    if (dto.barcode) {
      const existing = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
      if (existing) throw new ConflictException('Barcode already exists');
    }

    const product = await this.prisma.product.create({
      data: {
        gym_id: getTenantGymId()!,
        product_name: dto.product_name,
        description: dto.description,
        organization_id: dto.organization_id,
        branch_id: dto.branch_id,
        category_id: dto.category_id,
        sku: dto.sku,
        barcode: dto.barcode,
        price: dto.price,
        cost_price: dto.cost_price ?? 0,
        tax_rate: dto.tax_rate ?? 0,
        image_url: dto.image_url,
      },
      include: { category: true, branch: { select: { id: true, name: true } } },
    });

    // Auto-create inventory record if branch is specified
    if (dto.branch_id) {
      await this.prisma.inventory.create({
        data: {
          gym_id: getTenantGymId()!,
          product_id: product.id,
          branch_id: dto.branch_id,
          stock_quantity: dto.initial_stock ?? 0,
        },
      });
    }

    return product;
  }

  async findAllProducts(filters: {
    branch_id?: string;
    organization_id?: string;
    category_id?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, organization_id, category_id, status, search, page = 1, limit = 50 } = filters;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;
    const where: any = {};

    if (branch_id) where.branch_id = branch_id;
    if (organization_id) where.organization_id = organization_id;
    if (category_id) where.category_id = category_id;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { product_name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { product_name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          inventory: { select: { stock_quantity: true, reserved_quantity: true, reorder_level: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOneProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        inventory: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { stock_quantity: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found for this barcode');
    return product;
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { stock_quantity: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found for this SKU');
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.sku && dto.sku !== product.sku) {
      const conflict = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (conflict) throw new ConflictException('SKU already exists');
    }
    if (dto.barcode && dto.barcode !== product.barcode) {
      const conflict = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
      if (conflict) throw new ConflictException('Barcode already exists');
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        inventory: true,
      },
    });
  }

  // ── Inventory ─────────────────────────────────────────────────

  async getInventory(filters: {
    branch_id?: string;
    low_stock?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, low_stock, page = 1, limit = 50 } = filters;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;
    const where: any = {};

    if (branch_id) where.branch_id = branch_id;

    // For low_stock: Prisma cannot express WHERE stock_quantity <= reorder_level (two-column comparison)
    // natively, so we fetch all matching rows first then filter and paginate in memory.
    if (low_stock) {
      // Fetch only what we need to filter (no skip/take before filter)
      const allRows = await this.prisma.inventory.findMany({
        where: branch_id ? { branch_id } : {},
        include: {
          product: {
            select: {
              id: true,
              product_name: true,
              sku: true,
              barcode: true,
              price: true,
              cost_price: true,
              status: true,
              category: { select: { id: true, name: true } },
            },
          },
          branch: { select: { id: true, name: true } },
        },
      });

      const filtered = allRows.filter((i) => i.stock_quantity <= i.reorder_level);
      const total = filtered.length;
      const data = filtered.slice(skip, skip + limit);
      return { data, total, page, limit };
    }

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          product: {
            select: {
              id: true,
              product_name: true,
              sku: true,
              barcode: true,
              price: true,
              cost_price: true,
              status: true,
              category: { select: { id: true, name: true } },
            },
          },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async adjustInventory(dto: AdjustInventoryDto) {
    return this.prisma.$transaction(async (tx) => {
      // Read stock inside transaction to prevent race condition
      const inventory = await tx.inventory.findUnique({
        where: { product_id: dto.product_id },
      });
      if (!inventory) throw new NotFoundException('Inventory record not found for this product');

      const newQuantity = inventory.stock_quantity + dto.quantity;
      if (newQuantity < 0) {
        throw new BadRequestException('Adjustment would result in negative stock');
      }

      const updated = await tx.inventory.update({
        where: { product_id: dto.product_id },
        data: {
          stock_quantity: newQuantity,
          last_updated: new Date(),
        },
        include: {
          product: { select: { id: true, product_name: true, sku: true } },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          product_id: dto.product_id,
          branch_id: dto.branch_id,
          transaction_type: dto.transaction_type,
          quantity: dto.quantity,
          notes: dto.notes,
        },
      });

      return updated;
    });
  }

  async updateReorderLevel(productId: string, dto: UpdateReorderLevelDto) {
    const inv = await this.prisma.inventory.findUnique({ where: { product_id: productId } });
    if (!inv) throw new NotFoundException('Inventory record not found');
    return this.prisma.inventory.update({
      where: { product_id: productId },
      data: { reorder_level: dto.reorder_level },
    });
  }

  async getInventoryTransactions(filters: {
    product_id?: string;
    branch_id?: string;
    transaction_type?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const { product_id, branch_id, transaction_type, start_date, end_date, page = 1, limit = 50 } = filters;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;
    const where: any = {};

    if (product_id) where.product_id = product_id;
    if (branch_id) where.branch_id = branch_id;
    if (transaction_type) where.transaction_type = transaction_type;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
        include: {
          product: { select: { id: true, product_name: true, sku: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.inventoryTransaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getLowStockAlerts(branchId?: string) {
    const where: any = {};
    if (branchId) where.branch_id = branchId;

    const allInventory = await this.prisma.inventory.findMany({
      where,
      include: {
        product: {
          select: { id: true, product_name: true, sku: true, barcode: true, status: true },
        },
        branch: { select: { id: true, name: true } },
      },
    });

    return allInventory
      .filter((i) => i.stock_quantity <= i.reorder_level && i.product.status === 'active')
      .map((i) => ({
        ...i,
        deficit: i.reorder_level - i.stock_quantity,
      }));
  }
}
