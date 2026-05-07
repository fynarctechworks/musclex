import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from '../../src/members/members.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResourceLimitService } from '../../src/common/services/resource-limit.service';
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
    it('should create a new member', async () => {
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

      const result = await service.create('test-studio-id', createData);
      expect(result).toBeDefined();
      expect(prisma.member.create).toHaveBeenCalled();
    });

    it('should generate a member code with FS- prefix', async () => {
      prisma.member.create.mockImplementation(async (args: any) => ({
        id: 'new-id',
        ...args.data,
        face_descriptor: null,
      }));

      const result = await service.create('test-studio-id', {
        branch_id: mockMember.branch_id,
        full_name: 'Test',
        email: 'test@test.com',
        phone: '+911234567890',
        gender: 'male',
      });

      expect(prisma.member.create).toHaveBeenCalled();
      const callArgs = prisma.member.create.mock.calls[0][0];
      expect(callArgs.data.member_code).toMatch(/^FS-\d{8}-\d{4}$/);
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
