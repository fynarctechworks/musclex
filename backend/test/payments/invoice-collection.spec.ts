import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../../src/payments/payments.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PublicPrismaService } from '../../src/prisma/public-prisma.service';
import { TenantPrisma } from '../../src/prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../../src/prisma/tenant-task-runner';
import { StripeService } from '../../src/payments/stripe.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingService } from '../../src/payments/billing.service';
import { RazorpayService } from '../../src/payments/razorpay.service';
import { BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockMember } from '../test-utils';

/**
 * Collecting an existing invoice through a gateway.
 *
 * Before this, both gateway paths demanded a plan_id and never forwarded
 * invoice_id — and the live CreateOrderDto had no invoice_id field at all, so
 * `forbidNonWhitelisted` rejected any attempt to send one. A card-collected
 * invoice therefore stayed `pending` forever.
 *
 * The rule that matters most here: the order must be raised for what is still
 * OWED, not the invoice total, or a second collection re-charges the full
 * amount after a partial cash payment.
 */
describe('PaymentsService — gateway invoice collection', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockBillingService = {
    recalculateInvoiceStatus: jest.fn(),
    generateInvoice: jest.fn(),
    getInvoiceBalance: jest.fn(),
  };

  const mockRazorpayService = {
    configured: true,
    getKeyId: jest.fn().mockReturnValue('rzp_test_key'),
    createOrder: jest.fn().mockResolvedValue({ id: 'order_INV1', status: 'created' }),
    verifyCheckoutSignature: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    prisma.member.findFirst.mockResolvedValue(mockMember);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      currency: 'INR',
      amount: 400,
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PublicPrismaService, useValue: prisma },
        { provide: TenantPrisma, useValue: { client: prisma } },
        {
          provide: TenantTaskRunner,
          useValue: {
            runForGym: (_g: string, fn: () => unknown) => fn(),
            forEachTenant: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            configured: true,
            createPaymentIntent: jest.fn(),
            getPaymentIntent: jest.fn(),
            refundPayment: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: BillingService, useValue: mockBillingService },
        { provide: RazorpayService, useValue: mockRazorpayService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  const invoice = (over: Record<string, unknown> = {}) => ({
    invoice: {
      id: 'inv-1',
      invoice_number: 'INV-20260804-0001',
      status: 'partial',
      currency: 'INR',
      ...over,
    },
    total: 1000,
    total_paid: 600,
    balance: 400,
  });

  it('charges the OUTSTANDING balance, not the invoice total', async () => {
    mockBillingService.getInvoiceBalance.mockResolvedValue(invoice());

    const res = await service.createOrder('studio-1', {
      member_id: mockMember.id,
      branch_id: 'branch-1',
      invoice_id: 'inv-1',
      gateway: 'razorpay',
    });

    // 1000 total, 600 already paid → charge 400, never 1000.
    expect(res.amount).toBe(400);
    expect(mockRazorpayService.createOrder.mock.calls[0][0].amount).toBe(400);
    expect(prisma.payment.create.mock.calls[0][0].data.amount).toBe(400);
  });

  it('links the pending payment to the invoice so it can reconcile', async () => {
    mockBillingService.getInvoiceBalance.mockResolvedValue(invoice());

    await service.createOrder('studio-1', {
      member_id: mockMember.id,
      branch_id: 'branch-1',
      invoice_id: 'inv-1',
      gateway: 'razorpay',
    });

    expect(prisma.payment.create.mock.calls[0][0].data.invoice_id).toBe('inv-1');
    // The order notes carry the invoice so verify can settle without a plan.
    expect(mockRazorpayService.createOrder.mock.calls[0][0].notes.invoice_id).toBe('inv-1');
  });

  it('refuses a fully paid invoice instead of taking money for nothing', async () => {
    mockBillingService.getInvoiceBalance.mockResolvedValue({
      ...invoice({ status: 'paid' }),
      total_paid: 1000,
      balance: 0,
    });

    await expect(
      service.createOrder('studio-1', {
        member_id: mockMember.id,
        branch_id: 'branch-1',
        invoice_id: 'inv-1',
        gateway: 'razorpay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockRazorpayService.createOrder).not.toHaveBeenCalled();
  });

  it('refuses a cancelled invoice', async () => {
    mockBillingService.getInvoiceBalance.mockResolvedValue(
      invoice({ status: 'cancelled' }),
    );

    await expect(
      service.createOrder('studio-1', {
        member_id: mockMember.id,
        branch_id: 'branch-1',
        invoice_id: 'inv-1',
        gateway: 'razorpay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockRazorpayService.createOrder).not.toHaveBeenCalled();
  });

  it('rejects an order with neither a plan nor an invoice', async () => {
    await expect(
      service.createOrder('studio-1', {
        member_id: mockMember.id,
        branch_id: 'branch-1',
        gateway: 'razorpay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
