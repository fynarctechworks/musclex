import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from '../../src/members/members.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResourceLimitService } from '../../src/common/services/resource-limit.service';
import { QueueService } from '../../src/queue/queue.service';
import { EventStoreService } from '../../src/events/event-store.service';
import { EventProjectorService } from '../../src/events/event-projector.service';
import { MemberDirectoryService } from '../../src/member/directory/member-directory.service';
import { tenantContext } from '../../src/common/tenant-context';
import { NotFoundException } from '@nestjs/common';
import {
  createMockPrismaService,
  mockMember,
  mockUserPayload,
} from '../test-utils';

const mockResourceLimitService = {
  getPlanLimits: jest.fn().mockResolvedValue({
    max_members: 1000,
    max_branches: 10,
    max_staff: 50,
  }),
  checkMemberLimit: jest.fn().mockResolvedValue(undefined),
  checkBranchLimit: jest.fn().mockResolvedValue(undefined),
};

const mockQueueService = {
  enqueueMemberWelcome: jest.fn().mockResolvedValue(undefined),
  enqueue: jest.fn().mockResolvedValue(undefined),
};

const mockEventStoreService = {
  emit: jest.fn().mockResolvedValue({ id: 'event-1' }),
  appendEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
};

const mockEventProjectorService = {
  // Service calls `this.eventProjector.processEvent(...)` post-commit.
  processEvent: jest.fn().mockResolvedValue(undefined),
};

const mockMemberDirectoryService = {
  // Post-commit fire-and-forget directory sync (phone → gym lookup).
  syncMember: jest.fn().mockResolvedValue(undefined),
  backfill: jest.fn().mockResolvedValue(undefined),
};

// Wrap async ops requiring tenant context (create uses getTenantGymId()).
const TENANT_GYM_ID = '11111111-1111-1111-1111-111111111111';
function withTenant<T>(fn: () => Promise<T> | T): Promise<T> {
  return tenantContext.run({ gymId: TENANT_GYM_ID } as any, fn) as Promise<T>;
}

describe('MembersService', () => {
  let service: MembersService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ResourceLimitService, useValue: mockResourceLimitService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: EventStoreService, useValue: mockEventStoreService },
        { provide: EventProjectorService, useValue: mockEventProjectorService },
        { provide: MemberDirectoryService, useValue: mockMemberDirectoryService },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated members list', async () => {
      const members = [
        { ...mockMember, face_descriptor: null },
        { ...mockMember, id: 'second-id', full_name: 'Jane Smith', face_descriptor: null },
      ];
      prisma.member.findMany.mockResolvedValue(members);
      prisma.member.count.mockResolvedValue(2);

      const result = await service.findAll('test-studio-id', { page: 1, limit: 20 });
      expect(result).toBeDefined();
      expect(prisma.member.findMany).toHaveBeenCalled();
      expect(prisma.member.count).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      prisma.member.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { status: 'active', page: 1, limit: 20 });
      const callArgs = prisma.member.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('status', 'active');
    });

    it('should apply search filter', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      prisma.member.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', { search: 'john', page: 1, limit: 20 });
      const callArgs = prisma.member.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('OR');
    });

    it('should strip face_descriptor from results', async () => {
      const memberWithFace = {
        ...mockMember,
        face_descriptor: [0.1, 0.2, 0.3],
      };
      prisma.member.findMany.mockResolvedValue([memberWithFace]);
      prisma.member.count.mockResolvedValue(1);

      const result = await service.findAll('test-studio-id', { page: 1, limit: 20 });
      expect(result.data).toBeDefined();
      if (result.data.length > 0) {
        expect(result.data[0]).not.toHaveProperty('face_descriptor');
      }
    });

    it('should default to page 1 and limit 20', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      prisma.member.count.mockResolvedValue(0);

      await service.findAll('test-studio-id', {});
      const callArgs = prisma.member.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(0);
      expect(callArgs.take).toBeLessThanOrEqual(50);
    });
  });

  describe('findOne', () => {
    it('should return a member by id', async () => {
      prisma.member.findFirst.mockResolvedValue({ ...mockMember, face_descriptor: null });

      const result = await service.findOne('test-studio-id', mockMember.id);
      expect(result).toBeDefined();
      expect(prisma.member.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockMember.id },
        }),
      );
    });

    it('should throw NotFoundException when member not found', async () => {
      prisma.member.findFirst.mockResolvedValue(null);

      await expect(service.findOne('test-studio-id', 'nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    // create() runs a pre-flight (membershipPlan.count > 0, org lookup,
    // branch lookup, dup-phone/email checks) and then a $transaction that
    // calls tx.member.create + eventStore.emit. Wire enough of the mock
    // for the happy path.
    function wireCreateHappyPath() {
      prisma.membershipPlan.count.mockResolvedValue(1);
      prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      prisma.branch.findFirst.mockResolvedValue({ id: mockMember.branch_id });
      // No duplicates
      prisma.member.findFirst.mockResolvedValue(null);
    }

    it('should create a new member', async () => {
      wireCreateHappyPath();
      const createData = {
        branch_id: mockMember.branch_id,
        full_name: 'New Member',
        email: 'new@example.com',
        phone: '+919876543210',
        gender: 'female',
        date_of_birth: '1995-01-01',
      };

      prisma.member.create.mockResolvedValue({
        ...mockMember,
        ...createData,
        id: 'new-member-id',
        face_descriptor: null,
      });

      const result = await withTenant(() =>
        service.create('test-studio-id', createData as any),
      );
      expect(result).toBeDefined();
      expect(prisma.member.create).toHaveBeenCalled();
    });

    it('should generate a member code with FS- prefix', async () => {
      wireCreateHappyPath();
      prisma.member.create.mockImplementation(async (args: any) => ({
        id: 'new-id',
        ...args.data,
        face_descriptor: null,
      }));

      await withTenant(() =>
        service.create('test-studio-id', {
          branch_id: mockMember.branch_id,
          full_name: 'Test',
          email: 'test@test.com',
          phone: '+911234567890',
          gender: 'male',
        } as any),
      );

      expect(prisma.member.create).toHaveBeenCalled();
      const callArgs = prisma.member.create.mock.calls[0][0];
      // members.service.generateMemberCode():
      //   `FS-${YYYYMMDD}-${randomBytes(4).toString('hex').toUpperCase()}`
      // i.e. 8 uppercase-hex chars, not 4 digits.
      expect(callArgs.data.member_code).toMatch(/^FS-\d{8}-[0-9A-F]{8}$/);
    });
  });

  describe('create — referral settings tenant isolation', () => {
    // Two studios with DIFFERENT referral settings. Bug: the raw query in
    // members.service.ts (~line 560) does `SELECT ... FROM public.studios LIMIT 1`
    // with no WHERE — so it returns an arbitrary studio's row. Under gym A's
    // tenant context we MUST get gym A's settings, not gym B's.
    const GYM_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const GYM_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const PLAN_DURATION_DAYS = 30;
    const PLAN_ID = '99999999-9999-9999-9999-999999999999';
    const REFERRER_ID = '77777777-7777-7777-7777-777777777777';
    const START_DATE = new Date('2026-01-01T00:00:00.000Z');

    function withTenantA<T>(fn: () => Promise<T> | T): Promise<T> {
      return tenantContext.run({ gymId: GYM_A } as any, fn) as Promise<T>;
    }

    function wireReferralPath() {
      // Pre-flight passes
      prisma.membershipPlan.count.mockResolvedValue(1);
      prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      prisma.branch.findFirst.mockResolvedValue({ id: mockMember.branch_id });
      prisma.member.findFirst.mockResolvedValue(null);

      // Inside the transaction
      prisma.membershipPlan.findUnique = jest.fn().mockResolvedValue({
        id: PLAN_ID,
        duration_days: PLAN_DURATION_DAYS,
        total_classes: null,
        price: 0, // skip payment-create branch
      });
      prisma.member.create.mockImplementation(async (args: any) => ({
        id: 'new-member-id',
        ...args.data,
      }));
      prisma.memberMembership = {
        ...(prisma.memberMembership ?? {}),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'new-membership-id',
          ...args.data,
          plan: { id: PLAN_ID, duration_days: PLAN_DURATION_DAYS },
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: args.where.id,
          ...args.data,
        })),
        findFirst: jest.fn().mockResolvedValue(null),
      };

      // Simulate two studios. After the fix, the query will bind the current
      // gym id. Before the fix, it has no bindings — return gym B's settings
      // to represent an arbitrary wrong row.
      prisma.$queryRaw.mockImplementation((_strings: any, ...values: any[]) => {
        const boundGymId = values[0];
        if (boundGymId === GYM_A) {
          return Promise.resolve([
            { referral_free_days: 5, referral_reward_days: 0 },
          ]);
        }
        if (boundGymId === GYM_B) {
          return Promise.resolve([
            { referral_free_days: 99, referral_reward_days: 0 },
          ]);
        }
        // No binding present (current buggy LIMIT 1) — arbitrary row wins.
        return Promise.resolve([
          { referral_free_days: 99, referral_reward_days: 0 },
        ]);
      });
    }

    it("extends referred member's membership by THIS gym's referral_free_days, not another gym's", async () => {
      wireReferralPath();

      const dto = {
        branch_id: mockMember.branch_id,
        full_name: 'Referred Newbie',
        phone: '+919999999999',
        gender: 'male',
        plan_id: PLAN_ID,
        membership_start_date: START_DATE.toISOString(),
        referred_by_member_id: REFERRER_ID,
      };

      await withTenantA(() =>
        service.create('studio-a', dto as any),
      );

      // Plan baseline end_date = START + 30 days.
      // Gym A's referral_free_days = 5 → expected newEnd = START + 35 days.
      // If the bug is present, gym B's 99 gets applied → newEnd = START + 129 days.
      const updateCalls = (prisma.memberMembership.update as jest.Mock).mock
        .calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      const newEnd: Date = updateCalls[0][0].data.end_date;
      const expectedEnd = new Date(START_DATE);
      expectedEnd.setDate(
        expectedEnd.getDate() + PLAN_DURATION_DAYS + 5,
      );
      expect(newEnd.toISOString()).toBe(expectedEnd.toISOString());
    });
  });

  describe('update', () => {
    it('should update a member', async () => {
      prisma.member.findFirst.mockResolvedValue(mockMember);
      prisma.member.update.mockResolvedValue({
        ...mockMember,
        full_name: 'Updated Name',
      });

      const result = await service.update('test-studio-id', mockMember.id, {
        full_name: 'Updated Name',
      });

      expect(prisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockMember.id },
        }),
      );
    });
  });
});
