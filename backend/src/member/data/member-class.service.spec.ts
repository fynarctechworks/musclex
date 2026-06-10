import { MemberClassService } from './member-class.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Member class browse/book/cancel. Asserts (a) listing is scoped to the
 * member's own branch + future, non-cancelled classes, (b) other members'
 * bookings are reduced to a seat count and never leaked, (c) booking validates
 * the class before delegating to the shared admin enrollment logic with the
 * authenticated member's OWN id, and (d) cross-branch/past/cancelled bookings
 * are rejected.
 */
describe('MemberClassService', () => {
  const member: CurrentMemberContext = { appUserId: 'auA', memberId: 'mA', tenantId: 'tA', isGymMember: true };
  let prisma: any;
  let classes: any;
  let service: MemberClassService;

  const future = new Date(Date.now() + 3_600_000);
  const past = new Date(Date.now() - 3_600_000);

  beforeEach(() => {
    prisma = {
      member: { findFirst: jest.fn().mockResolvedValue({ branch_id: 'br1' }) },
      class: { findMany: jest.fn(), findFirst: jest.fn() },
      classEnrollment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    classes = { enroll: jest.fn(), cancelEnrollment: jest.fn() };
    service = new MemberClassService(prisma, classes);
  });

  describe('listUpcoming', () => {
    it('scopes to member branch + future/non-cancelled and computes seat + own-booking state', async () => {
      prisma.class.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Yoga',
          category: 'flexibility',
          starts_at: future,
          duration_minutes: 60,
          room: 'Studio A',
          capacity: 20,
          trainer: { full_name: 'Tara' },
        },
      ]);
      // 2 enrolled (one of them is THIS member) + 1 other waitlisted
      prisma.classEnrollment.findMany.mockResolvedValue([
        { class_id: 'c1', member_id: 'mA', status: 'enrolled', waitlist_position: null },
        { class_id: 'c1', member_id: 'mZ', status: 'enrolled', waitlist_position: null },
        { class_id: 'c1', member_id: 'mY', status: 'waitlisted', waitlist_position: 1 },
      ]);

      const out = await service.listUpcoming(member);

      const where = prisma.class.findMany.mock.calls[0][0].where;
      expect(where.branch_id).toBe('br1');
      expect(where.status).toEqual({ not: 'cancelled' });
      expect(where.starts_at.gte).toBeInstanceOf(Date);

      expect(out.classes).toEqual([
        {
          id: 'c1',
          title: 'Yoga',
          category: 'flexibility',
          startsAt: future.toISOString(),
          durationMinutes: 60,
          room: 'Studio A',
          trainerName: 'Tara',
          capacity: 20,
          seatsLeft: 18, // 20 - 2 enrolled (waitlisted doesn't take a seat)
          booked: true,
          bookingStatus: 'enrolled',
          waitlistPosition: null,
        },
      ]);
      // Response must not carry any other member's id
      expect(JSON.stringify(out)).not.toContain('mZ');
      expect(JSON.stringify(out)).not.toContain('mY');
    });

    it('returns an empty list (no second query) when the branch has no upcoming class', async () => {
      prisma.class.findMany.mockResolvedValue([]);
      const out = await service.listUpcoming(member);
      expect(out).toEqual({ classes: [] });
      expect(prisma.classEnrollment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('book', () => {
    it('enrolls via the shared admin logic with the member’s OWN id + tenant', async () => {
      prisma.class.findFirst.mockResolvedValue({
        branch_id: 'br1',
        status: 'scheduled',
        starts_at: future,
        capacity: 20,
      });
      classes.enroll.mockResolvedValue({ status: 'enrolled', waitlist_position: null, message: 'Successfully enrolled.' });
      prisma.classEnrollment.count.mockResolvedValue(3);

      const res = await service.book(member, 'c1');

      expect(classes.enroll).toHaveBeenCalledWith('tA', 'c1', 'mA');
      expect(res).toEqual({
        classId: 'c1',
        status: 'enrolled',
        waitlistPosition: null,
        seatsLeft: 17,
        message: 'Successfully enrolled.',
      });
    });

    it('rejects a class at another branch as not-found (no cross-branch booking)', async () => {
      prisma.class.findFirst.mockResolvedValue({
        branch_id: 'OTHER',
        status: 'scheduled',
        starts_at: future,
        capacity: 20,
      });
      await expect(service.book(member, 'c1')).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(classes.enroll).not.toHaveBeenCalled();
    });

    it('rejects a cancelled class', async () => {
      prisma.class.findFirst.mockResolvedValue({
        branch_id: 'br1',
        status: 'cancelled',
        starts_at: future,
        capacity: 20,
      });
      await expect(service.book(member, 'c1')).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(classes.enroll).not.toHaveBeenCalled();
    });

    it('rejects a class that already started', async () => {
      prisma.class.findFirst.mockResolvedValue({
        branch_id: 'br1',
        status: 'scheduled',
        starts_at: past,
        capacity: 20,
      });
      await expect(service.book(member, 'c1')).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(classes.enroll).not.toHaveBeenCalled();
    });

    it('passes through a waitlisted result when the class is full', async () => {
      prisma.class.findFirst.mockResolvedValue({
        branch_id: 'br1',
        status: 'scheduled',
        starts_at: future,
        capacity: 1,
      });
      classes.enroll.mockResolvedValue({ status: 'waitlisted', waitlist_position: 2, message: 'Class is full. Added to waitlist at position 2.' });
      prisma.classEnrollment.count.mockResolvedValue(1);

      const res = await service.book(member, 'c1');
      expect(res.status).toBe('waitlisted');
      expect(res.waitlistPosition).toBe(2);
      expect(res.seatsLeft).toBe(0);
    });
  });

  describe('cancel', () => {
    it('delegates with the member’s own id and maps the promoted member name', async () => {
      classes.cancelEnrollment.mockResolvedValue({
        cancelled: true,
        promoted: { enrollment_id: 'e9', member_name: 'Next Up' },
      });

      const res = await service.cancel(member, 'c1');
      expect(classes.cancelEnrollment).toHaveBeenCalledWith('tA', 'c1', 'mA');
      expect(res).toEqual({ cancelled: true, promotedMemberName: 'Next Up' });
    });

    it('returns null promotedMemberName when nobody was promoted', async () => {
      classes.cancelEnrollment.mockResolvedValue({ cancelled: true, promoted: null });
      const res = await service.cancel(member, 'c1');
      expect(res).toEqual({ cancelled: true, promotedMemberName: null });
    });
  });
});
