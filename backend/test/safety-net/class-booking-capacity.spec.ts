/**
 * SAFETY NET — class booking capacity (P1-M4-1 overbooking guard)
 *
 * bookClass must claim a seat via a GUARDED atomic updateMany
 * (`enrolled_count < capacity`), not a read-then-increment. These tests go RED
 * if a refactor reintroduces a stale-read capacity check that could overbook, or
 * stops routing a full session to the waitlist.
 */

import { BookingService } from '../../src/classes/booking.service';

function makeTx(overrides: any = {}) {
  return {
    classSession: {
      findUnique: jest.fn().mockResolvedValue({ id: 's1', capacity: 10, enrolled_count: 9, status: 'scheduled' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    classBooking: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: 'b1' }),
    },
    classWaitlist: {
      findUnique: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _max: { position: 2 } }),
      create: jest.fn().mockResolvedValue({ position: 3 }),
    },
    classAttendance: { upsert: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function makeService(tx: any) {
  const client = {
    classSession: { findUnique: jest.fn().mockResolvedValue({ id: 's1', status: 'scheduled' }) },
    $transaction: (cb: any) => cb(tx),
  };
  const tenant: any = { client };
  return { service: new BookingService(tenant), tx };
}

describe('SAFETY-NET / BookingService.bookClass capacity', () => {
  it('books via a guarded atomic seat-claim (updateMany with enrolled_count < capacity)', async () => {
    const tx = makeTx();
    const { service } = makeService(tx);

    const res: any = await service.bookClass({ session_id: 's1', member_id: 'm1' } as any);

    expect(res.status).toBe('booked');
    expect(tx.classSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ enrolled_count: { lt: 10 } }),
        data: { enrolled_count: { increment: 1 } },
      }),
    );
    // Must NOT use a separate unconditional increment (the racy path).
    expect(tx.classSession.update).not.toHaveBeenCalled();
  });

  it('routes to the waitlist when the seat-claim wins zero rows (session full)', async () => {
    const tx = makeTx({
      classSession: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1', capacity: 10, enrolled_count: 10, status: 'scheduled' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), // no seat free
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const { service } = makeService(tx);

    const res: any = await service.bookClass({ session_id: 's1', member_id: 'm1' } as any);

    expect(res.status).toBe('waitlisted');
    expect(res.position).toBe(3);
    expect(tx.classBooking.upsert).not.toHaveBeenCalled();
  });
});
