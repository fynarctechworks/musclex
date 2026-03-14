import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto';

import { randomInt } from 'crypto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(randomInt(1, 9999)).padStart(4, '0');
    return `PO-${date}-${seq}`;
  }

  // ── Suppliers ─────────────────────────────────────────────────

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async findAllSuppliers(filters: {
    organization_id?: string;
    is_active?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { organization_id, is_active, search, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (organization_id) where.organization_id = organization_id;
    if (is_active !== undefined) where.is_active = is_active;
    if (search) {
      where.OR = [
        { supplier_name: { contains: search, mode: 'insensitive' } },
        { contact_person: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { supplier_name: 'asc' },
        include: { _count: { select: { purchase_orders: true } } },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOneSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchase_orders: {
          take: 10,
          orderBy: { created_at: 'desc' },
          select: { id: true, order_number: true, total_amount: true, status: true, created_at: true },
        },
        _count: { select: { purchase_orders: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // ── Purchase Orders ───────────────────────────────────────────

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    // Validate supplier exists
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplier_id } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Validate all products exist
    const productIds = dto.items.map((i) => i.product_id);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found');
    }

    const orderNumber = this.generateOrderNumber();
    const items = dto.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
    }));
    const totalAmount = items.reduce((sum, i) => sum + i.total_price, 0);

    return this.prisma.purchaseOrder.create({
      data: {
        supplier_id: dto.supplier_id,
        branch_id: dto.branch_id,
        order_number: orderNumber,
        total_amount: totalAmount,
        status: 'pending',
        ordered_at: new Date(),
        notes: dto.notes,
        items: { create: items },
      },
      include: {
        supplier: { select: { id: true, supplier_name: true } },
        branch: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, product_name: true, sku: true } } },
        },
      },
    });
  }

  async findAllOrders(filters: {
    branch_id?: string;
    supplier_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, supplier_id, status, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (branch_id) where.branch_id = branch_id;
    if (supplier_id) where.supplier_id = supplier_id;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          supplier: { select: { id: true, supplier_name: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOneOrder(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, product_name: true, sku: true, barcode: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  async receivePurchaseOrder(id: string, dto: ReceivePurchaseOrderDto) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status === 'cancelled') {
      throw new BadRequestException('Cannot receive a cancelled order');
    }
    if (order.status === 'received') {
      throw new BadRequestException('Order already fully received');
    }

    return this.prisma.$transaction(async (tx) => {
      let allFullyReceived = true;

      for (const orderItem of order.items) {
        // If specific items provided, use those quantities; otherwise receive all
        let receiveQty = orderItem.quantity - orderItem.received_quantity;

        if (dto.received_items?.length) {
          const matchingItem = dto.received_items.find((ri) => ri.item_id === orderItem.id);
          if (matchingItem) {
            receiveQty = matchingItem.received_quantity;
          } else {
            // Not in the receive list — skip
            if (orderItem.received_quantity < orderItem.quantity) allFullyReceived = false;
            continue;
          }
        }

        if (receiveQty <= 0) {
          if (orderItem.received_quantity < orderItem.quantity) allFullyReceived = false;
          continue;
        }

        const newReceived = orderItem.received_quantity + receiveQty;
        if (newReceived > orderItem.quantity) {
          throw new BadRequestException(
            `Cannot receive more than ordered for item ${orderItem.id}`,
          );
        }
        if (newReceived < orderItem.quantity) allFullyReceived = false;

        // Update PO item
        await tx.purchaseOrderItem.update({
          where: { id: orderItem.id },
          data: { received_quantity: newReceived },
        });

        // Add to inventory
        const existing = await tx.inventory.findUnique({
          where: { product_id: orderItem.product_id },
        });

        if (existing) {
          await tx.inventory.update({
            where: { product_id: orderItem.product_id },
            data: {
              stock_quantity: { increment: receiveQty },
              last_updated: new Date(),
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              product_id: orderItem.product_id,
              branch_id: order.branch_id,
              stock_quantity: receiveQty,
            },
          });
        }

        // Log transaction
        await tx.inventoryTransaction.create({
          data: {
            product_id: orderItem.product_id,
            branch_id: order.branch_id,
            transaction_type: 'purchase',
            quantity: receiveQty,
            reference_id: order.id,
          },
        });
      }

      const newStatus = allFullyReceived ? 'received' : 'partial';

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          received_at: allFullyReceived ? new Date() : undefined,
        },
        include: {
          supplier: { select: { id: true, supplier_name: true } },
          items: {
            include: { product: { select: { id: true, product_name: true, sku: true } } },
          },
        },
      });
    });
  }

  async cancelOrder(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status === 'received') {
      throw new BadRequestException('Cannot cancel a fully received order');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }
}
