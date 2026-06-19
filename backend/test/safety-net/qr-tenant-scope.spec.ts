/**
 * SAFETY NET — QR controller tenant scoping (P1-M3-1 guard)
 *
 * QrController must scope every member access by the caller's gym (studio_id).
 * These go RED if a refactor drops the gym_id filter and lets a caller read or
 * mutate another gym's member by passing a raw member UUID (cross-tenant read /
 * qr_version tampering).
 */

import { NotFoundException } from '@nestjs/common';
import { QrController } from '../../src/check-ins/qr/qr.controller';

const USER: any = { studio_id: 'gym-A', user_id: 'u1' };

function makeController(prismaMember: any) {
  const qrTokens: any = {
    signStatic: jest.fn().mockReturnValue('tok'),
    signDynamic: jest.fn().mockReturnValue({ token: 'tok', jti: 'j', iat: 1, exp: 2 }),
  };
  const prisma: any = { member: prismaMember };
  return new QrController(qrTokens, prisma);
}

describe('SAFETY-NET / QrController tenant scoping', () => {
  it('getStatic filters by gym_id and 404s a cross-tenant member', async () => {
    const findFirst = jest.fn().mockResolvedValue(null); // member not in caller's gym
    const ctrl = makeController({ findFirst });

    await expect(ctrl.getStatic(USER, 'gymB-member')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'gymB-member', gym_id: 'gym-A' }),
      }),
    );
  });

  it('regenerate verifies gym ownership BEFORE the qr_version write', async () => {
    const findFirst = jest.fn().mockResolvedValue(null); // cross-tenant target
    const update = jest.fn();
    const ctrl = makeController({ findFirst, update });

    await expect(ctrl.regenerate(USER, 'gymB-member')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // The cross-tenant write must never happen.
    expect(update).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'gymB-member', gym_id: 'gym-A' }),
      }),
    );
  });

  it('regenerate proceeds for an owned member', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'm1' });
    const update = jest.fn().mockResolvedValue({
      id: 'm1', qr_version: 2, member_code: 'MX1', qr_regenerated_at: new Date(),
    });
    const ctrl = makeController({ findFirst, update });

    const res = await ctrl.regenerate(USER, 'm1');
    expect(update).toHaveBeenCalledTimes(1);
    expect(res.qr_version).toBe(2);
  });
});
