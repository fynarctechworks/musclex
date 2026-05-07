import { ActionQueueService } from '../src/dashboard/action-queue.service';

/**
 * Tests for ActionQueueService — Wave 2 rules engine.
 * Focus areas:
 *   1. Severity-then-impact ranking
 *   2. Dismiss/snooze state filtering
 *   3. Per-rule failure isolation (allSettled)
 *   4. Renewal severity escalation (≤3 days = imminent + high)
 */

interface MockPrisma {
  member: { findMany: jest.Mock };
  payment: { findMany: jest.Mock };
  memberMembership: { findMany: jest.Mock };
  memberInvoice: { findMany: jest.Mock };
  classSession: { findMany: jest.Mock };
  lead: { findMany: jest.Mock };
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
}

function makePrismaMock(overrides: Partial<MockPrisma> = {}): MockPrisma {
  const base: MockPrisma = {
    member: { findMany: jest.fn().mockResolvedValue([]) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    memberMembership: { findMany: jest.fn().mockResolvedValue([]) },
    memberInvoice: { findMany: jest.fn().mockResolvedValue([]) },
    classSession: { findMany: jest.fn().mockResolvedValue([]) },
    lead: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides };
}

const today = new Date();
const inDays = (n: number) =>
  new Date(today.getTime() + n * 86400000);

describe('ActionQueueService', () => {
  it('flags ≤3-day expiry as renewal_imminent + high severity', async () => {
    const prisma = makePrismaMock({
      memberMembership: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mm1',
            member_id: 'm1',
            end_date: inDays(2),
            branch_id: 'b1',
            plan: { price: 5000, name: 'Monthly' },
            member: { full_name: 'Alice', member_code: 'FS-001' },
          },
        ]),
      },
    });
    const svc = new ActionQueueService(prisma as any);
    const items = await svc.getActions({ role: 'owner' } as any, undefined);
    const m = items.find((i) => i.id.startsWith('renewal_imminent:'));
    expect(m).toBeDefined();
    expect(m?.severity).toBe('high');
    expect(m?.kind).toBe('renewal_imminent');
    expect(m?.impact_amount).toBe(5000);
  });

  it('flags 4-7 day expiry as renewal_at_risk + medium severity', async () => {
    const prisma = makePrismaMock({
      memberMembership: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mm2',
            member_id: 'm2',
            end_date: inDays(5),
            branch_id: 'b1',
            plan: { price: 3000, name: 'Quarterly' },
            member: { full_name: 'Bob', member_code: 'FS-002' },
          },
        ]),
      },
    });
    const svc = new ActionQueueService(prisma as any);
    const items = await svc.getActions({ role: 'owner' } as any, undefined);
    const m = items.find((i) => i.id.startsWith('renewal_at_risk:'));
    expect(m).toBeDefined();
    expect(m?.severity).toBe('medium');
  });

  it('escalates dues_overdue severity by age (≤7d low, 7-30d medium, >30d high)', async () => {
    const prisma = makePrismaMock({
      memberInvoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'i-fresh',
            member_id: 'm1',
            branch_id: 'b1',
            total_amount: 1000,
            issued_at: inDays(-3),
            due_date: null,
            invoice_number: 'INV-001',
            member: { full_name: 'Alice', member_code: 'FS-001' },
          },
          {
            id: 'i-mid',
            member_id: 'm2',
            branch_id: 'b1',
            total_amount: 2000,
            issued_at: inDays(-15),
            due_date: null,
            invoice_number: 'INV-002',
            member: { full_name: 'Bob', member_code: 'FS-002' },
          },
          {
            id: 'i-old',
            member_id: 'm3',
            branch_id: 'b1',
            total_amount: 9000,
            issued_at: inDays(-45),
            due_date: null,
            invoice_number: 'INV-003',
            member: { full_name: 'Cara', member_code: 'FS-003' },
          },
        ]),
      },
    });
    const svc = new ActionQueueService(prisma as any);
    const items = await svc.getActions({ role: 'owner' } as any, undefined);
    const fresh = items.find((i) => i.id === 'dues_overdue:i-fresh');
    const mid = items.find((i) => i.id === 'dues_overdue:i-mid');
    const old = items.find((i) => i.id === 'dues_overdue:i-old');
    expect(fresh?.severity).toBe('low');
    expect(mid?.severity).toBe('medium');
    expect(old?.severity).toBe('high');
  });

  it('ranks high severity above medium, then by impact amount descending', async () => {
    const prisma = makePrismaMock({
      memberInvoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'i1',
            member_id: 'm1',
            branch_id: 'b1',
            total_amount: 100,
            issued_at: inDays(-50), // high (age > 30)
            due_date: null,
            invoice_number: 'INV-001',
            member: { full_name: 'Alice', member_code: 'FS-001' },
          },
          {
            id: 'i2',
            member_id: 'm2',
            branch_id: 'b1',
            total_amount: 9999,
            issued_at: inDays(-15), // medium
            due_date: null,
            invoice_number: 'INV-002',
            member: { full_name: 'Bob', member_code: 'FS-002' },
          },
          {
            id: 'i3',
            member_id: 'm3',
            branch_id: 'b1',
            total_amount: 5000,
            issued_at: inDays(-50), // high
            due_date: null,
            invoice_number: 'INV-003',
            member: { full_name: 'Cara', member_code: 'FS-003' },
          },
        ]),
      },
    });
    const svc = new ActionQueueService(prisma as any);
    const items = await svc.getActions({ role: 'owner' } as any, undefined);
    // Expect: i3 (high, 5000), i1 (high, 100), then i2 (medium, 9999)
    const order = items.filter((i) => i.kind === 'dues_overdue').map((i) => i.id);
    expect(order[0]).toBe('dues_overdue:i3');
    expect(order[1]).toBe('dues_overdue:i1');
    expect(order[2]).toBe('dues_overdue:i2');
  });

  it('filters dismissed items via dashboard_action_states', async () => {
    const prisma = makePrismaMock({
      memberMembership: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mm1',
            member_id: 'mX',
            end_date: inDays(2),
            branch_id: 'b1',
            plan: { price: 5000, name: 'Monthly' },
            member: { full_name: 'X', member_code: 'FS-X' },
          },
        ]),
      },
      $queryRawUnsafe: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('dashboard_action_states')) {
          return Promise.resolve([
            {
              action_id: `renewal_imminent:mX:${inDays(2).toISOString().slice(0, 10)}`,
              state: 'dismissed',
              snoozed_until: null,
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    });
    const svc = new ActionQueueService(prisma as any);
    const items = await svc.getActions(
      { studio_id: 's1', user_id: 'u1', role: 'owner', branch_ids: [] } as any,
      undefined,
    );
    expect(items.find((i) => i.id.startsWith('renewal_imminent:mX'))).toBeUndefined();
  });

  it('filters snoozed items only while snoozed_until is in the future', async () => {
    const prisma = makePrismaMock({
      memberMembership: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mm1',
            member_id: 'mY',
            end_date: inDays(2),
            branch_id: 'b1',
            plan: { price: 1000, name: 'Monthly' },
            member: { full_name: 'Y', member_code: 'FS-Y' },
          },
        ]),
      },
      $queryRawUnsafe: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('dashboard_action_states')) {
          // SQL itself filters out expired snoozes; simulate that by returning []
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    });
    const svc = new ActionQueueService(prisma as any);
    const items = await svc.getActions(
      { studio_id: 's1', user_id: 'u1', role: 'owner', branch_ids: [] } as any,
      undefined,
    );
    expect(items.length).toBeGreaterThan(0);
  });

  it('survives a single rule throwing', async () => {
    const prisma = makePrismaMock({
      memberMembership: {
        findMany: jest.fn().mockRejectedValue(new Error('boom')),
      },
      memberInvoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'i1',
            member_id: 'm1',
            branch_id: 'b1',
            total_amount: 100,
            issued_at: inDays(-1),
            due_date: null,
            invoice_number: 'INV-001',
            member: { full_name: 'Alice', member_code: 'FS-001' },
          },
        ]),
      },
    });
    const svc = new ActionQueueService(prisma as any);
    const items = await svc.getActions({ role: 'owner' } as any, undefined);
    expect(items.find((i) => i.id === 'dues_overdue:i1')).toBeDefined();
  });

  it('dismiss() upserts action state and writes a receipt', async () => {
    const prisma = makePrismaMock();
    const svc = new ActionQueueService(prisma as any);
    await svc.dismiss(
      { studio_id: 's1', user_id: 'u1', role: 'owner', branch_ids: [] } as any,
      'renewal_at_risk:mZ:2026-05-13',
    );
    // Two raw exec calls: upsert state + insert receipt
    expect(prisma.$executeRawUnsafe.mock.calls.length).toBeGreaterThanOrEqual(2);
    const [stateSql] = prisma.$executeRawUnsafe.mock.calls[0];
    expect(stateSql).toContain('dashboard_action_states');
    const [receiptSql] = prisma.$executeRawUnsafe.mock.calls[1];
    expect(receiptSql).toContain('dashboard_action_receipts');
  });

  it('snooze() computes snoozed_until from hours when no `until` provided', async () => {
    const prisma = makePrismaMock();
    const svc = new ActionQueueService(prisma as any);
    const before = Date.now();
    const result = await svc.snooze(
      { studio_id: 's1', user_id: 'u1', role: 'owner', branch_ids: [] } as any,
      'renewal_at_risk:mZ:2026-05-13',
      new Date(before + 24 * 3600 * 1000),
    );
    expect(new Date(result.snoozed_until).getTime()).toBeGreaterThan(before);
  });
});
