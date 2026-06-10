/**
 * SAFETY NET — CHECK-IN / CHECK-OUT
 *
 * Guards the server-side check-out flow on CheckInsService. The "record a
 * check-in" path proper goes through CheckInOrchestrator (heavy + already
 * has its own test). What's NOT covered anywhere today is checkOut, which
 * has two business-critical safety properties:
 *   1. Idempotency — re-scanning the same member must not error or
 *      double-close their visit.
 *   2. "No open visit" is reported as a structured failure, not a 500.
 *
 * We also lock duration_minutes computation so a refactor can't silently
 * produce negative or wildly wrong session durations.
 */

import { CheckInsService } from '../../src/check-ins/check-ins.service';

describe('SAFETY-NET / CheckInsService.checkOut', () => {
  let service: CheckInsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      checkIn: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      member: {
        findFirst: jest.fn(),
      },
    };
    service = new CheckInsService(prisma, {} as any, {} as any);
  });

  it('returns no_open_visit (not an error) when nothing is open', async () => {
    prisma.checkIn.findFirst.mockResolvedValue(null);

    const result = await service.checkOut({
      member_id: 'm-1',
      branch_id: 'b-1',
    });

    expect(result).toEqual({
      success: false,
      failure_reason: 'no_open_visit',
      message: expect.any(String),
    });
    expect(prisma.checkIn.update).not.toHaveBeenCalled();
  });

  it('is idempotent — already-checked-out visits report success without re-updating', async () => {
    const closedAt = new Date('2026-05-23T11:30:00Z');
    prisma.checkIn.findFirst.mockResolvedValue({
      id: 'ci-1',
      member_id: 'm-1',
      branch_id: 'b-1',
      checked_in_at: new Date('2026-05-23T10:00:00Z'),
      check_out_at: closedAt,
    });

    const result = await service.checkOut({
      member_id: 'm-1',
      branch_id: 'b-1',
    });

    expect(result.success).toBe(true);
    expect((result as any).already_checked_out).toBe(true);
    expect(prisma.checkIn.update).not.toHaveBeenCalled();
  });

  it('computes duration_minutes correctly for a closed visit', async () => {
    const checkedInAt = new Date('2026-05-23T10:00:00Z');
    prisma.checkIn.findFirst.mockResolvedValue({
      id: 'ci-2',
      member_id: 'm-1',
      branch_id: 'b-1',
      checked_in_at: checkedInAt,
      check_out_at: null,
    });
    // Simulate the update returning a closed-out row with a 75-minute session.
    const checkedOutAt = new Date('2026-05-23T11:15:00Z');
    prisma.checkIn.update.mockResolvedValue({
      id: 'ci-2',
      checked_in_at: checkedInAt,
      check_out_at: checkedOutAt,
      member: { full_name: 'John Doe', member_code: 'FS-1', profile_photo_url: null },
      branch: { name: 'Main' },
    });

    const result: any = await service.checkOut({
      member_id: 'm-1',
      branch_id: 'b-1',
    });

    expect(result.success).toBe(true);
    expect(result.duration_minutes).toBe(75);
    expect(result.member_name).toBe('John Doe');
    expect(result.member_code).toBe('FS-1');
  });

  it('requires at least one identifier (member_id, check_in_id, or qr_code)', async () => {
    await expect(
      service.checkOut({ branch_id: 'b-1' } as any),
    ).rejects.toThrow();
  });
});
