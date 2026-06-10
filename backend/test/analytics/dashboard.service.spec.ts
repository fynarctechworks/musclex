import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createMockPrismaService, mockUserPayload } from '../test-utils';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getKpis', () => {
    it('should return KPI data with all required fields', async () => {
      prisma.member.count.mockResolvedValue(150);
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: 500000 },
      });
      prisma.checkIn.count.mockResolvedValue(300);
      prisma.memberMembership.count.mockResolvedValue(5);

      const result = await service.getKpis(mockUserPayload as any);
      expect(result).toBeDefined();
      expect(result.active_members).toBe(150);
    });

    it('should handle zero data gracefully', async () => {
      prisma.member.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      prisma.checkIn.count.mockResolvedValue(0);
      prisma.memberMembership.count.mockResolvedValue(0);

      const result = await service.getKpis(mockUserPayload as any);
      expect(result).toBeDefined();
      expect(result.monthly_revenue).toBe(0);
    });
  });

  describe('getRevenueChart', () => {
    it('should return 12 months of revenue data', async () => {
      prisma.payment.groupBy.mockResolvedValue([
        { paid_at: new Date('2026-03-01'), _sum: { amount: 50000 } },
        { paid_at: new Date('2026-02-01'), _sum: { amount: 45000 } },
      ]);

      const result = await service.getRevenueChart(mockUserPayload as any);
      expect(result).toBeDefined();
    });

    it('should handle empty revenue data', async () => {
      prisma.payment.groupBy.mockResolvedValue([]);

      const result = await service.getRevenueChart(mockUserPayload as any);
      expect(result).toBeDefined();
    });
  });

  describe('getAlerts', () => {
    it('should return alerts array', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.memberMembership.findMany.mockResolvedValue([]);

      const result = await service.getAlerts();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getActivityFeed', () => {
    it('should return recent activity entries', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.checkIn.findMany.mockResolvedValue([]);

      const result = await service.getActivityFeed();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getBranchComparison', () => {
    it('should return branch comparison data', async () => {
      // Current impl ([dashboard.service.ts:283-318]) does NOT use groupBy;
      // it fans out per-branch with member.count + payment.aggregate +
      // checkIn.count.
      prisma.branch.findMany.mockResolvedValue([
        { id: 'branch-1', name: 'Main Branch' },
      ]);
      prisma.member.count.mockResolvedValue(50);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });
      prisma.checkIn.count.mockResolvedValue(30);

      const result = (await service.getBranchComparison()) as any[];
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].branch_name).toBe('Main Branch');
      expect(result[0].active_members).toBe(50);
      expect(result[0].monthly_revenue).toBe(100000);
      expect(result[0].monthly_check_ins).toBe(30);
    });
  });
});
