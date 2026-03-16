import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../../src/payments/payments.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../../src/payments/billing.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { createMockPrismaService, createMockConfigService, mockPayment, mockMember } from '../test-utils';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const mockBillingService = {
    recalculateInvoiceStatus: jest.fn(),
    generateInvoice: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createMockConfigService() },
        { provide: BillingService, useValue: mockBillingService },
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

      const result = await service.findAll({});
      expect(result).toBeDefined();
      expect(prisma.payment.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll({ status: 'paid' });
      const callArgs = prisma.payment.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('status', 'paid');
    });

    it('should filter by branch_id', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll({ branch_id: mockMember.branch_id });
      const callArgs = prisma.payment.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('branch_id', mockMember.branch_id);
    });
  });

  describe('recordCash', () => {
    it('should create a cash payment with receipt number', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.payment.create.mockImplementation(async (args: any) => ({
        id: 'new-payment-id',
        ...args.data,
      }));

      const result = await service.recordCash({
        member_id: mockMember.id,
        branch_id: mockMember.branch_id,
        amount: 3000,
        notes: 'Monthly fee',
      });

      expect(prisma.payment.create).toHaveBeenCalled();
      const callArgs = prisma.payment.create.mock.calls[0][0];
      expect(callArgs.data.payment_method).toBe('cash');
      expect(callArgs.data.status).toBe('paid');
      expect(callArgs.data.receipt_number).toMatch(/^RCP-\d{8}-\d{4}$/);
    });

    it('should throw when member not found', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.recordCash({
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
