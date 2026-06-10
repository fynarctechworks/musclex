/**
 * SAFETY NET — POS SALE MONEY MATH
 *
 * The POS sale endpoint is real money. These tests pin the most
 * dangerous-if-wrong arithmetic in PosService.createSale:
 *   1. Standalone product line: subtotal, tax, and total are computed
 *      from unit_price × quantity × tax_rate as expected.
 *   2. A discount larger than the bill is clamped — total can never go
 *      negative (would mean issuing money to a customer).
 *   3. A cart line that specifies neither product_id nor bundle_id (or
 *      both) is rejected before any money math runs.
 *
 * We mock every collaborator. We do NOT exercise the bundle/wallet/batch
 * paths — those have their own surface area; we only protect the simplest
 * cash-product happy path + the negative-total guard.
 */

import { BadRequestException } from '@nestjs/common';
import { PosService } from '../../src/inventory/pos.service';
import { tenantContext } from '../../src/common/tenant-context';

function buildMocks() {
  const product = {
    id: 'p-1',
    product_name: 'Protein Bar',
    track_batches: false,
    price: 100,
    tax_rate: 10, // 10% GST
    status: 'active',
    inventory: [{ branch_id: 'b-1', stock_quantity: 50 }],
    branch_prices: [],
  };

  const created: any = { data: null };

  const prisma: any = {
    product: {
      findMany: jest.fn().mockResolvedValue([product]),
    },
    branch: {
      findUnique: jest.fn().mockResolvedValue({
        gym_id: 'g-1',
        state: 'Karnataka',
        gst_state_code: '29',
      }),
    },
    studio: {
      findUnique: jest.fn().mockResolvedValue({
        gst_state_code: '29',
        state: 'Karnataka',
      }),
    },
    posSale: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        created.data = data;
        // The service later reads sale.items by index — synthesize them.
        return {
          id: 'sale-1',
          ...data,
          items: data.items.create.map((it: any, i: number) => ({ id: `si-${i}`, ...it })),
        };
      }),
      update: jest.fn(),
    },
    posSaleItem: {
      update: jest.fn(),
    },
    inventory: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ stock_quantity: 50 }),
    },
    inventoryTransaction: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  };

  // Stub services that aren't exercised in the cash-product path.
  const batchService: any = { deductFifo: jest.fn() };
  const walletService: any = {
    redeemPoints: jest.fn(),
    debitForPurchase: jest.fn(),
    earnPoints: jest.fn().mockResolvedValue(0),
  };
  const bundleService: any = { checkAvailability: jest.fn(), buildSaleLines: jest.fn() };

  return { prisma, batchService, walletService, bundleService, created };
}

function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContext.run(
    {
      schemaName: 'public',
      gymId: 'g-1',
      activeBranchId: 'b-1',
      allowedBranchIds: 'ALL',
      bypassBranchScope: false,
    },
    fn,
  );
}

describe('SAFETY-NET / PosService.createSale — money math', () => {
  it('computes subtotal, tax and total correctly for a simple cash sale', async () => {
    const { prisma, batchService, walletService, bundleService, created } = buildMocks();
    const service = new PosService(prisma, batchService, walletService, bundleService);

    const sale: any = await withTenant(() =>
      service.createSale({
        branch_id: 'b-1',
        staff_id: 'st-1',
        payment_method: 'cash',
        items: [{ product_id: 'p-1', quantity: 2 }],
      } as any),
    );

    // 2 × 100 = 200 subtotal; 10% tax = 20; no discount; total = 220.
    expect(Number(created.data.subtotal)).toBe(200);
    expect(Number(created.data.tax_amount)).toBe(20);
    expect(Number(created.data.discount_amount)).toBe(0);
    expect(Number(created.data.total_amount)).toBe(220);

    // Intrastate sale (seller 29 / buyer 29) ⇒ CGST + SGST split, no IGST.
    expect(Number(created.data.cgst_amount)).toBe(10);
    expect(Number(created.data.sgst_amount)).toBe(10);
    expect(Number(created.data.igst_amount)).toBe(0);

    // Stock must be deducted exactly once.
    expect(prisma.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(sale.id).toBe('sale-1');
  });

  it('clamps total to zero when manual discount exceeds the bill', async () => {
    const { prisma, batchService, walletService, bundleService, created } = buildMocks();
    const service = new PosService(prisma, batchService, walletService, bundleService);

    await withTenant(() =>
      service.createSale({
        branch_id: 'b-1',
        staff_id: 'st-1',
        payment_method: 'cash',
        discount_amount: 9999, // way more than the 220 bill
        items: [{ product_id: 'p-1', quantity: 2 }],
      } as any),
    );

    // Total must never go negative — would mean owing money to the customer.
    expect(Number(created.data.total_amount)).toBe(0);
    expect(Number(created.data.total_amount)).toBeGreaterThanOrEqual(0);
  });

  it('rejects a cart line that names both product_id and bundle_id', async () => {
    const { prisma, batchService, walletService, bundleService } = buildMocks();
    const service = new PosService(prisma, batchService, walletService, bundleService);

    await expect(
      withTenant(() =>
        service.createSale({
          branch_id: 'b-1',
          staff_id: 'st-1',
          payment_method: 'cash',
          items: [{ product_id: 'p-1', bundle_id: 'bun-1', quantity: 1 }],
        } as any),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a cart line that names neither product_id nor bundle_id', async () => {
    const { prisma, batchService, walletService, bundleService } = buildMocks();
    const service = new PosService(prisma, batchService, walletService, bundleService);

    await expect(
      withTenant(() =>
        service.createSale({
          branch_id: 'b-1',
          staff_id: 'st-1',
          payment_method: 'cash',
          items: [{ quantity: 1 }],
        } as any),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
