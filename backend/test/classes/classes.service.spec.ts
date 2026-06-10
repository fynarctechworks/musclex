import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from '../../src/classes/classes.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResourceLimitService } from '../../src/common/services/resource-limit.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createMockPrismaService, mockClass, mockMember } from '../test-utils';

// A starts_at that is reliably in the future relative to "now" so the
// service's past-date guard doesn't short-circuit the conflict test.
const FUTURE_STARTS_AT = new Date(Date.now() + 30 * 86400000).toISOString();

const mockResourceLimitService = {
  checkFeatureAccess: jest.fn().mockResolvedValue(undefined),
};

describe('ClassesService', () => {
  let service: ClassesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ResourceLimitService, useValue: mockResourceLimitService },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated classes', async () => {
      prisma.class.findMany.mockResolvedValue([mockClass]);
      prisma.class.count.mockResolvedValue(1);

      const result = await service.findAll('test-studio-id', { page: 1, limit: 20 });
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category', async () => {
      prisma.class.findMany.mockResolvedValue([]);
      prisma.class.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { category: 'yoga' });
      const callArgs = prisma.class.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('category', 'yoga');
    });

    it('should filter by status', async () => {
      prisma.class.findMany.mockResolvedValue([]);
      prisma.class.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { status: 'active' });
      const callArgs = prisma.class.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('status', 'active');
    });

    it('should filter by trainer_id', async () => {
      prisma.class.findMany.mockResolvedValue([]);
      prisma.class.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { trainer_id: mockClass.trainer_id });
      const callArgs = prisma.class.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('trainer_id', mockClass.trainer_id);
    });

    it('should include only ENROLLED enrollments so length = headcount', async () => {
      prisma.class.findMany.mockResolvedValue([]);
      prisma.class.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { page: 1, limit: 20 });
      const callArgs = prisma.class.findMany.mock.calls[0][0];
      expect(callArgs.include.enrollments).toEqual({
        where: { status: 'enrolled' },
        select: { id: true },
      });
      // Must NOT use the unfiltered _count (would include waitlisted/cancelled)
      expect(callArgs.include._count).toBeUndefined();
    });

    it('should apply date range filter', async () => {
      prisma.class.findMany.mockResolvedValue([]);
      prisma.class.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', {
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });
      const callArgs = prisma.class.findMany.mock.calls[0][0];
      expect(callArgs.where.starts_at).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return a class by id', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);

      const result = await service.findOne('test-studio-id', mockClass.id);
      expect(result).toBeDefined();
      expect(result.id).toBe(mockClass.id);
    });

    it('should throw NotFoundException when class not found', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(service.findOne('test-studio-id', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a class when no trainer conflict', async () => {
      prisma.class.findFirst.mockResolvedValue(null);
      // Service validates the trainer belongs to the branch before creating.
      prisma.staff.findFirst.mockResolvedValue({
        id: mockClass.trainer_id,
        role: 'trainer',
        branch_id: mockClass.branch_id,
      });
      prisma.class.create.mockResolvedValue({
        ...mockClass,
        branch: { id: mockClass.branch_id, name: 'Main' },
        trainer: { id: mockClass.trainer_id, full_name: 'Trainer A' },
        substitute_trainer: null,
      });

      const result = await service.create('test-studio-id', {
        branch_id: mockClass.branch_id,
        trainer_id: mockClass.trainer_id,
        name: 'Morning Yoga',
        category: 'yoga',
        capacity: 20,
        duration_minutes: 60,
        starts_at: FUTURE_STARTS_AT,
      });

      expect(result).toBeDefined();
      expect(prisma.class.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when trainer is double-booked', async () => {
      // Existing class starts at the same time as the new one → real overlap.
      prisma.class.findMany.mockResolvedValue([
        {
          id: 'existing-id',
          name: 'Existing Class',
          starts_at: new Date(FUTURE_STARTS_AT),
          duration_minutes: 60,
        },
      ]);

      await expect(
        service.create('test-studio-id', {
          branch_id: mockClass.branch_id,
          trainer_id: mockClass.trainer_id,
          name: 'New Yoga',
          category: 'yoga',
          capacity: 20,
          duration_minutes: 60,
          starts_at: FUTURE_STARTS_AT,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should NOT conflict when the trainer has a class at a different, non-overlapping time', async () => {
      // Existing 30-min class ends an hour BEFORE the new class starts.
      const newStart = new Date(FUTURE_STARTS_AT);
      prisma.class.findMany.mockResolvedValue([
        {
          id: 'existing-id',
          name: 'Earlier Class',
          starts_at: new Date(newStart.getTime() - 90 * 60000), // starts 90 min before
          duration_minutes: 30, // ends 60 min before the new class → no overlap
        },
      ]);
      prisma.staff.findFirst.mockResolvedValue({
        id: mockClass.trainer_id,
        role: 'trainer',
        branch_id: mockClass.branch_id,
      });
      prisma.class.create.mockResolvedValue({
        ...mockClass,
        branch: { id: mockClass.branch_id, name: 'Main' },
        trainer: { id: mockClass.trainer_id, full_name: 'Trainer A' },
        substitute_trainer: null,
      });

      await expect(
        service.create('test-studio-id', {
          branch_id: mockClass.branch_id,
          trainer_id: mockClass.trainer_id,
          name: 'New Yoga',
          category: 'yoga',
          capacity: 20,
          duration_minutes: 60,
          starts_at: FUTURE_STARTS_AT,
        }),
      ).resolves.toBeDefined();
      expect(prisma.class.create).toHaveBeenCalled();
    });
  });

  describe('enroll / waitlist', () => {
    const CLASS_ID = mockClass.id;

    beforeEach(() => {
      // Member resolves by UUID for all enroll tests.
      prisma.member.findFirst.mockResolvedValue(mockMember);
    });

    it('enrolls directly when the class has open spots', async () => {
      prisma.class.findFirst.mockResolvedValue({ ...mockClass, capacity: 20 });
      prisma.classEnrollment.findFirst.mockResolvedValue(null); // not already enrolled
      prisma.classEnrollment.count.mockResolvedValue(5); // 5/20 → room left
      prisma.classEnrollment.create.mockResolvedValue({
        id: 'enr-1',
        status: 'enrolled',
        member: { id: mockMember.id, full_name: mockMember.full_name },
      });

      const res = await service.enroll('test-studio-id', CLASS_ID, mockMember.id);

      const createArg = prisma.classEnrollment.create.mock.calls[0][0];
      expect(createArg.data.status).toBe('enrolled');
      expect(createArg.data.waitlist_position).toBeUndefined();
      expect(res.message).toBe('Successfully enrolled.');
    });

    it('waitlists the 21st member of a 20-person class at position 1', async () => {
      prisma.class.findFirst.mockResolvedValue({ ...mockClass, capacity: 20 });
      prisma.classEnrollment.findFirst.mockResolvedValue(null);
      prisma.classEnrollment.count.mockResolvedValue(20); // full
      prisma.classEnrollment.aggregate.mockResolvedValue({
        _max: { waitlist_position: null }, // no one waitlisted yet
      });
      prisma.classEnrollment.create.mockResolvedValue({
        id: 'wl-1',
        status: 'waitlisted',
        waitlist_position: 1,
        member: { id: mockMember.id, full_name: mockMember.full_name },
      });

      const res = await service.enroll('test-studio-id', CLASS_ID, mockMember.id);

      const createArg = prisma.classEnrollment.create.mock.calls[0][0];
      expect(createArg.data.status).toBe('waitlisted');
      expect(createArg.data.waitlist_position).toBe(1);
      expect(res.message).toContain('position 1');
    });

    it('appends to the end of an existing waitlist (max + 1)', async () => {
      prisma.class.findFirst.mockResolvedValue({ ...mockClass, capacity: 20 });
      prisma.classEnrollment.findFirst.mockResolvedValue(null);
      prisma.classEnrollment.count.mockResolvedValue(20);
      prisma.classEnrollment.aggregate.mockResolvedValue({
        _max: { waitlist_position: 2 }, // two already waitlisted
      });
      prisma.classEnrollment.create.mockResolvedValue({
        id: 'wl-3',
        status: 'waitlisted',
        waitlist_position: 3,
        member: { id: mockMember.id, full_name: mockMember.full_name },
      });

      await service.enroll('test-studio-id', CLASS_ID, mockMember.id);

      const createArg = prisma.classEnrollment.create.mock.calls[0][0];
      expect(createArg.data.waitlist_position).toBe(3);
    });

    it('rejects a member who is already enrolled', async () => {
      prisma.class.findFirst.mockResolvedValue({ ...mockClass, capacity: 20 });
      prisma.classEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'enrolled',
      });

      await expect(
        service.enroll('test-studio-id', CLASS_ID, mockMember.id),
      ).rejects.toThrow('Member is already enrolled for this class');
    });
  });

  describe('cancelEnrollment — auto-promotion', () => {
    const CLASS_ID = mockClass.id;
    const MEMBER_ID = mockMember.id;

    it('promotes the front of the waitlist when an enrolled member cancels', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      // 1st findFirst = the cancelling member's enrollment; 2nd = next waitlisted.
      prisma.classEnrollment.findFirst
        .mockResolvedValueOnce({ id: 'enr-1', status: 'enrolled', member_id: MEMBER_ID })
        .mockResolvedValueOnce({ id: 'wl-1', status: 'waitlisted', waitlist_position: 1 });
      prisma.classEnrollment.update
        .mockResolvedValueOnce({ id: 'enr-1', status: 'cancelled' }) // cancel
        .mockResolvedValueOnce({
          id: 'wl-1',
          status: 'enrolled',
          member: { id: 'm-2', full_name: 'Jane Promoted' },
        }); // promote
      prisma.classEnrollment.findMany.mockResolvedValue([]); // nothing left to resequence

      const res = await service.cancelEnrollment('test-studio-id', CLASS_ID, MEMBER_ID);

      expect(res.cancelled).toBe(true);
      expect(res.promoted).toEqual({
        enrollment_id: 'wl-1',
        member_name: 'Jane Promoted',
      });
      // The promotion clears the waitlist position and flips status to enrolled.
      const promoteCall = prisma.classEnrollment.update.mock.calls[1][0];
      expect(promoteCall.where.id).toBe('wl-1');
      expect(promoteCall.data.status).toBe('enrolled');
      expect(promoteCall.data.waitlist_position).toBeNull();
    });

    it('does NOT promote anyone when a WAITLISTED member cancels, and re-sequences the rest', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.classEnrollment.findFirst.mockResolvedValueOnce({
        id: 'wl-1',
        status: 'waitlisted',
        member_id: MEMBER_ID,
      });
      prisma.classEnrollment.update.mockResolvedValue({});
      // After removal, position-2 member must shift up to position 1.
      prisma.classEnrollment.findMany.mockResolvedValue([
        { id: 'wl-2', waitlist_position: 2 },
      ]);

      const res = await service.cancelEnrollment('test-studio-id', CLASS_ID, MEMBER_ID);

      expect(res.promoted).toBeNull();
      // Only one findFirst (no next-waitlisted lookup) since nobody was enrolled.
      expect(prisma.classEnrollment.findFirst).toHaveBeenCalledTimes(1);
      // Re-sequence moved wl-2 from position 2 to position 1.
      const resequenced = prisma.classEnrollment.update.mock.calls.find(
        (c: any) => c[0].where.id === 'wl-2',
      );
      expect(resequenced[0].data.waitlist_position).toBe(1);
    });

    it('promotes nobody when an enrolled member cancels and the waitlist is empty', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.classEnrollment.findFirst
        .mockResolvedValueOnce({ id: 'enr-1', status: 'enrolled', member_id: MEMBER_ID })
        .mockResolvedValueOnce(null); // empty waitlist
      prisma.classEnrollment.update.mockResolvedValue({ id: 'enr-1', status: 'cancelled' });
      prisma.classEnrollment.findMany.mockResolvedValue([]);

      const res = await service.cancelEnrollment('test-studio-id', CLASS_ID, MEMBER_ID);

      expect(res).toEqual({ cancelled: true, promoted: null });
    });
  });
});
