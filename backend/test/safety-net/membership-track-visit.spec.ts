/**
 * SAFETY NET — MEMBERSHIP trackVisit (P2-M2-1 atomic-decrement guard)
 *
 * trackVisit must decrement remaining_visits ATOMICALLY via a guarded
 * updateMany (`remaining_visits > 0`), never via read-then-write. These tests go
 * RED if a refactor reintroduces a read-modify-write that could double-spend the
 * last visit, or stops rejecting a zero-visit membership.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MembershipService } from '../../src/members/membership.service';

function makeService(client: any) {
  const tenant: any = { client };
  const memberReferrals: any = {};
  return new MembershipService(tenant, memberReferrals);
}

describe('SAFETY-NET / MembershipService.trackVisit', () => {
  it('decrements atomically via a guarded updateMany (not read-then-write)', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'm1', status: 'active', remaining_visits: 5 })
      .mockResolvedValueOnce({ remaining_visits: 4 });
    const client = { memberMembership: { findUnique, updateMany, update: jest.fn() } };

    const res = await makeService(client).trackVisit('m1');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ remaining_visits: { gt: 0 } }),
        data: { remaining_visits: { decrement: 1 } },
      }),
    );
    // Must NOT use a plain absolute-value update (the racy path).
    expect(client.memberMembership.update).not.toHaveBeenCalled();
    expect(res).toEqual({ remaining_visits: 4 });
  });

  it('rejects when no visits remain (guarded updateMany matches 0 rows)', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'm1', status: 'active', remaining_visits: 0 });
    const client = { memberMembership: { findUnique, updateMany, update: jest.fn() } };

    await expect(makeService(client).trackVisit('m1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('treats null remaining_visits as unlimited (no decrement)', async () => {
    const updateMany = jest.fn();
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'm1', status: 'active', remaining_visits: null });
    const client = { memberMembership: { findUnique, updateMany, update: jest.fn() } };

    const res = await makeService(client).trackVisit('m1');
    expect(res).toEqual({ remaining_visits: null });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('404s an unknown membership', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce(null);
    const client = { memberMembership: { findUnique, updateMany: jest.fn(), update: jest.fn() } };
    await expect(makeService(client).trackVisit('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
