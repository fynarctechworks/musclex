import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from '../../src/classes/classes.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createMockPrismaService, mockClass } from '../test-utils';

describe('ClassesService', () => {
  let service: ClassesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: PrismaService, useValue: prisma },
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
        starts_at: '2026-03-20T06:00:00Z',
      });

      expect(result).toBeDefined();
      expect(prisma.class.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when trainer is double-booked', async () => {
      prisma.class.findFirst.mockResolvedValue({
        ...mockClass,
        name: 'Existing Class',
      });

      await expect(
        service.create('test-studio-id', {
          branch_id: mockClass.branch_id,
          trainer_id: mockClass.trainer_id,
          name: 'New Yoga',
          category: 'yoga',
          capacity: 20,
          duration_minutes: 60,
          starts_at: '2026-03-20T06:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
