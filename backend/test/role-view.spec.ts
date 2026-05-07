import { DashboardPulseService } from '../src/dashboard/dashboard-pulse.service';
import { ActionQueueService } from '../src/dashboard/action-queue.service';
import {
  resolveRoleView,
  capabilitiesFor,
} from '../src/dashboard/role-view.util';

interface MockPrisma {
  member: { count: jest.Mock; findMany: jest.Mock };
  payment: { aggregate: jest.Mock; findMany: jest.Mock };
  checkIn: { count: jest.Mock };
  memberMembership: { findMany: jest.Mock };
  memberInvoice: { findMany: jest.Mock };
  classSession: { findMany: jest.Mock };
  classAttendance: { findMany: jest.Mock; count: jest.Mock };
  lead: { findMany: jest.Mock };
  staff: { findFirst: jest.Mock };
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
}

function makePrismaMock(overrides: Partial<MockPrisma> = {}): MockPrisma {
  const base: MockPrisma = {
    member: {
      count: jest.fn().mockResolvedValue(50),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1500 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    checkIn: { count: jest.fn().mockResolvedValue(10) },
    memberMembership: { findMany: jest.fn().mockResolvedValue([]) },
    memberInvoice: { findMany: jest.fn().mockResolvedValue([]) },
    classSession: { findMany: jest.fn().mockResolvedValue([]) },
    classAttendance: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    lead: { findMany: jest.fn().mockResolvedValue([]) },
    staff: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ mrr: 0 }]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides };
}

describe('role-view utility', () => {
  it('maps owner-like roles to "owner" view', () => {
    expect(resolveRoleView({ role: 'owner' } as any)).toBe('owner');
    expect(resolveRoleView({ role: 'super_admin' } as any)).toBe('owner');
    expect(resolveRoleView({ role: 'brand_owner' } as any)).toBe('owner');
  });
  it('maps manager → manager, trainer → trainer', () => {
    expect(resolveRoleView({ role: 'manager' } as any)).toBe('manager');
    expect(resolveRoleView({ role: 'trainer' } as any)).toBe('trainer');
  });
  it('maps everything else to front_desk', () => {
    expect(resolveRoleView({ role: 'receptionist' } as any)).toBe('front_desk');
    expect(resolveRoleView({ role: 'foo' } as any)).toBe('front_desk');
    expect(resolveRoleView(undefined)).toBe('front_desk');
  });
  it('owner has financials + churn signals; front_desk has neither', () => {
    expect(capabilitiesFor('owner').see_financials).toBe(true);
    expect(capabilitiesFor('owner').see_churn_signals).toBe(true);
    expect(capabilitiesFor('front_desk').see_financials).toBe(false);
    expect(capabilitiesFor('front_desk').see_churn_signals).toBe(false);
    expect(capabilitiesFor('front_desk').compact_mode).toBe(true);
    expect(capabilitiesFor('trainer').scope_to_self).toBe(true);
    expect(capabilitiesFor('trainer').see_financials).toBe(false);
  });
});

describe('DashboardPulseService — role filtering', () => {
  it('strips today_revenue / mrr / outstanding_dues for front_desk', async () => {
    const prisma = makePrismaMock();
    const svc = new DashboardPulseService(prisma as any);
    const result = await svc.getPulse({ role: 'receptionist' } as any);
    expect(result.view).toBe('front_desk');
    expect(result.today_revenue.value).toBe(0);
    expect(result.mrr.value).toBe(0);
    expect(result.outstanding_dues.value).toBe(0);
    expect(result.outstanding_dues.invoice_count).toBe(0);
    // Operations metrics survive
    expect(result.check_ins_today.value).toBe(10);
    expect(result.active_members.value).toBe(50);
  });

  it('strips renewals_at_risk for front_desk (no churn signals)', async () => {
    const prisma = makePrismaMock();
    const svc = new DashboardPulseService(prisma as any);
    const result = await svc.getPulse({ role: 'receptionist' } as any);
    expect(result.renewals_at_risk_7d.value).toBe(0);
    expect(result.renewals_at_risk_7d.value_at_stake).toBe(0);
  });

  it('strips financials for trainer but keeps check-in metric', async () => {
    const prisma = makePrismaMock();
    const svc = new DashboardPulseService(prisma as any);
    const result = await svc.getPulse({ role: 'trainer' } as any);
    expect(result.view).toBe('trainer');
    expect(result.today_revenue.value).toBe(0);
    expect(result.mrr.value).toBe(0);
    expect(result.outstanding_dues.value).toBe(0);
    expect(result.check_ins_today.value).toBe(10);
  });

  it('owner sees full financials', async () => {
    const prisma = makePrismaMock();
    const svc = new DashboardPulseService(prisma as any);
    const result = await svc.getPulse({ role: 'owner' } as any);
    expect(result.view).toBe('owner');
    expect(result.today_revenue.value).toBe(1500);
  });

  it('caches per-view (owner and front_desk get distinct entries)', async () => {
    const prisma = makePrismaMock();
    const svc = new DashboardPulseService(prisma as any);
    await svc.getPulse({ role: 'owner', studio_id: 's1' } as any);
    await svc.getPulse({ role: 'receptionist', studio_id: 's1' } as any);
    // The two calls should NOT collide — different keys → both compute.
    expect(prisma.member.count.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('ActionQueueService — role filtering', () => {
  it('front_desk only runs dues/class/lead rules (no renewals, no failed payments, no inactive)', async () => {
    const prisma = makePrismaMock();
    const svc = new ActionQueueService(prisma as any);
    await svc.getActions({ role: 'receptionist' } as any, undefined);
    // memberMembership.findMany feeds renewal_at_risk → should NOT be called
    expect(prisma.memberMembership.findMany).not.toHaveBeenCalled();
    // payment.findMany feeds payment_failed → should NOT be called
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
    // memberInvoice.findMany feeds dues_overdue → SHOULD be called
    expect(prisma.memberInvoice.findMany).toHaveBeenCalled();
    // lead.findMany feeds lead_cold → SHOULD be called
    expect(prisma.lead.findMany).toHaveBeenCalled();
  });

  it('trainer only runs trainer-relevant rules and no dues/leads', async () => {
    const prisma = makePrismaMock({
      staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
    });
    const svc = new ActionQueueService(prisma as any);
    await svc.getActions(
      { role: 'trainer', user_id: 'u1', studio_id: 's1' } as any,
      undefined,
    );
    expect(prisma.staff.findFirst).toHaveBeenCalled();
    expect(prisma.memberInvoice.findMany).not.toHaveBeenCalled();
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('owner runs all rules', async () => {
    const prisma = makePrismaMock();
    const svc = new ActionQueueService(prisma as any);
    await svc.getActions({ role: 'owner' } as any, undefined);
    expect(prisma.memberMembership.findMany).toHaveBeenCalled();
    expect(prisma.memberInvoice.findMany).toHaveBeenCalled();
    expect(prisma.payment.findMany).toHaveBeenCalled();
    expect(prisma.lead.findMany).toHaveBeenCalled();
  });
});
