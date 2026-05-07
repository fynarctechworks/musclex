import { ForbiddenException } from '@nestjs/common';
import { ReportsService, ReportUserScope } from '../../src/analytics/services/reports.service';

function mockPrisma() {
  return {
    revenueAnalytics: { findMany: jest.fn().mockResolvedValue([]) },
    membershipAnalytics: { findMany: jest.fn().mockResolvedValue([]) },
    dailyGymMetrics: { findMany: jest.fn().mockResolvedValue([]) },
    trainerAnalytics: { findMany: jest.fn().mockResolvedValue([]) },
    posSale: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('ReportsService — branch-scope enforcement', () => {
  it('OWNER may request any branch', async () => {
    const prisma = mockPrisma();
    const svc = new ReportsService(prisma);
    const user: ReportUserScope = { role: 'owner', branch_ids: [] };

    await expect(
      svc.generateReport(
        { report_type: 'revenue', format: 'pdf', branch_id: 'branch-123' } as any,
        user,
      ),
    ).resolves.toBeDefined();

    expect(prisma.revenueAnalytics.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branch_id: 'branch-123' }),
      }),
    );
  });

  it('NON-OWNER requesting an out-of-scope branch_id throws ForbiddenException', async () => {
    const prisma = mockPrisma();
    const svc = new ReportsService(prisma);
    const user: ReportUserScope = { role: 'receptionist', branch_ids: ['branch-A'] };

    await expect(
      svc.generateReport(
        { report_type: 'revenue', format: 'pdf', branch_id: 'branch-B' } as any,
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('NON-OWNER without branch_id is clamped to their assigned branches', async () => {
    const prisma = mockPrisma();
    const svc = new ReportsService(prisma);
    const user: ReportUserScope = {
      role: 'manager',
      branch_ids: ['branch-A', 'branch-B'],
    };

    await svc.generateReport(
      { report_type: 'revenue', format: 'pdf' } as any,
      user,
    );

    expect(prisma.revenueAnalytics.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branch_id: { in: ['branch-A', 'branch-B'] },
        }),
      }),
    );
  });

  it('NON-OWNER with EMPTY branch_ids gets a no-match sentinel (fail-closed)', async () => {
    const prisma = mockPrisma();
    const svc = new ReportsService(prisma);
    const user: ReportUserScope = { role: 'trainer', branch_ids: [] };

    await svc.generateReport(
      { report_type: 'membership', format: 'pdf' } as any,
      user,
    );

    expect(prisma.membershipAnalytics.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branch_id: '__none__' }),
      }),
    );
  });

  it('NON-OWNER requesting their OWN branch_id is allowed', async () => {
    const prisma = mockPrisma();
    const svc = new ReportsService(prisma);
    const user: ReportUserScope = { role: 'manager', branch_ids: ['branch-A'] };

    await svc.generateReport(
      { report_type: 'attendance', format: 'pdf', branch_id: 'branch-A' } as any,
      user,
    );

    expect(prisma.dailyGymMetrics.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branch_id: 'branch-A' }),
      }),
    );
  });

  it('OWNER without branch_id gets no branch filter (all branches)', async () => {
    const prisma = mockPrisma();
    const svc = new ReportsService(prisma);
    const user: ReportUserScope = { role: 'owner' };

    await svc.generateReport(
      { report_type: 'trainer', format: 'pdf' } as any,
      user,
    );

    const callArgs = prisma.trainerAnalytics.findMany.mock.calls[0]?.[0];
    expect(callArgs.where).not.toHaveProperty('branch_id');
  });
});
