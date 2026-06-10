import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../../src/payments/payments.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BillingService } from '../../src/payments/billing.service';
import { RazorpayService } from '../../src/payments/razorpay.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, mockPayment, mockMember } from '../test-utils';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockBillingService = {
    recalculateInvoiceStatus: jest.fn(),
    generateInvoice: jest.fn(),
  };

  const mockRazorpayService = {
    configured: true,
    getKeyId: jest.fn().mockReturnValue('rzp_test_key'),
    createOrder: jest
      .fn()
      .mockResolvedValue({ id: 'order_TEST123', amount: 100000, currency: 'INR', status: 'created' }),
    verifyCheckoutSignature: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: mockBillingService },
        { provide: RazorpayService, useValue: mockRazorpayService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated payments list', async () => {
      prisma.payment.findMany.mockResolvedValue([mockPayment]);
      prisma.payment.count.mockResolvedValue(1);

      const result = await service.findAll('test-studio-id', {});
      expect(result).toBeDefined();
      expect(prisma.payment.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { status: 'paid' });
      const callArgs = prisma.payment.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('status', 'paid');
    });

    it('should filter by branch_id', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { branch_id: mockMember.branch_id });
      const callArgs = prisma.payment.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('branch_id', mockMember.branch_id);
    });
  });

  describe('recordCash', () => {
    it('should create a cash payment with receipt number', async () => {
      // recordCash uses member.findFirst (not findUnique)
      prisma.member.findFirst.mockResolvedValue(mockMember);
      // recordCash runs inside $transaction; the mock passes prisma as tx
      prisma.payment.create.mockImplementation(async (args: any) => ({
        id: 'new-payment-id',
        ...args.data,
      }));
      prisma.financialTransaction.create.mockResolvedValue({});

      const result = await service.recordCash('test-studio-id', {
        member_id: mockMember.id,
        branch_id: mockMember.branch_id,
        amount: 3000,
        notes: 'Monthly fee',
      });

      expect(prisma.payment.create).toHaveBeenCalled();
      const callArgs = prisma.payment.create.mock.calls[0][0];
      expect(callArgs.data.payment_method).toBe('cash');
      expect(callArgs.data.status).toBe('paid');
      // payments.service.generateReceiptNumber():
      //   `RCP-${YYYYMMDD}-${randomBytes(4).toString('hex').toUpperCase()}`
      // i.e. 8 uppercase-hex chars, not 4 digits.
      expect(callArgs.data.receipt_number).toMatch(/^RCP-\d{8}-[0-9A-F]{8}$/);
    });

    it('should throw when member not found', async () => {
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(
        service.recordCash('test-studio-id', {
          member_id: 'nonexistent',
          branch_id: mockMember.branch_id,
          amount: 3000,
        }),
      ).rejects.toThrow();
    });
  });

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.findOne(mockPayment.id);
      expect(result).toBeDefined();
      expect(result.id).toBe(mockPayment.id);
    });

    it('should throw NotFoundException when payment not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
