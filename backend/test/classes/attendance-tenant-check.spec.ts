import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../../src/classes/attendance.service';

/**
 * The tenant check on class attendance.
 *
 * This gated on `session.branch.organization_id !== studioId`. But
 * `Branch.organization_id` is NULLABLE and is null for every single-org gym —
 * which is the default — so the comparison was `null !== '<studio uuid>'`:
 * always true, always Forbidden. Class attendance was completely unusable.
 *
 * Verified against a seeded gym before the fix: its own owner received
 * "Access denied to this session" reading attendance for its own class.
 *
 * The check now compares `gym_id`, the tenant key this system actually scopes
 * on (see src/prisma/tenant-models.ts).
 */
describe('AttendanceService — tenant check', () => {
  const GYM = 'gym-1';
  const OTHER_GYM = 'gym-2';
  const SESSION_ID = 'sess-1';

  function build(session: unknown) {
    const client = {
      classSession: { findFirst: jest.fn().mockResolvedValue(session) },
      classAttendance: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const tenant = { client } as never;
    return { service: new AttendanceService(tenant), client };
  }

  it('allows a gym to read attendance for its OWN session', async () => {
    // The regression: this threw Forbidden for every single-org gym.
    const { service } = build({ id: SESSION_ID, gym_id: GYM, status: 'scheduled' });
    await expect(service.getSessionAttendance(GYM, SESSION_ID)).resolves.toBeDefined();
  });

  it('allows it even though organization_id is null', async () => {
    // Stated separately because null organization_id is the DEFAULT shape,
    // not an edge case — it is what every single-org gym looks like.
    const { service } = build({
      id: SESSION_ID, gym_id: GYM, status: 'scheduled', organization_id: null,
    });
    await expect(service.getSessionAttendance(GYM, SESSION_ID)).resolves.toBeDefined();
  });

  it('still refuses another gym session', async () => {
    // The check must remain a real boundary, not merely stop failing.
    const { service } = build({ id: SESSION_ID, gym_id: OTHER_GYM, status: 'scheduled' });
    await expect(service.getSessionAttendance(GYM, SESSION_ID))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s a session that does not exist', async () => {
    const { service } = build(null);
    await expect(service.getSessionAttendance(GYM, SESSION_ID))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
