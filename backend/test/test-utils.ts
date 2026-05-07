import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

/**
 * Creates a mock PrismaService with common operations stubbed.
 */
export function createMockPrismaService() {
  const result: any = {
    member: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    class: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    checkIn: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    branch: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    membershipPlan: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    classEnrollment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    aiConversation: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiMessage: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    subscriptionPlan: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    memberMembership: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    financialTransaction: {
      create: jest.fn(),
    },
    apiKey: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ exists: true }]),
    $transaction: jest.fn().mockImplementation((fn: any) => {
      // If fn is a function (interactive transaction), call it with the prisma mock itself
      if (typeof fn === 'function') {
        return fn(mockPrisma);
      }
      // If fn is an array of promises, resolve them
      return Promise.all(fn);
    }),
  };
  // Self-reference for $transaction callback
  const mockPrisma = result;
  return result;
}

/**
 * Creates a mock ConfigService
 */
export function createMockConfigService(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    HASH_SECRET: 'test-hash-secret-32-chars-minimum',
    ANTHROPIC_API_KEY: '',
    CORS_ORIGINS: 'http://localhost:3000',
    NODE_ENV: 'test',
    REDIS_URL: '',
  };
  const config = { ...defaults, ...overrides };
  return {
    get: jest.fn((key: string, defaultVal?: string) => config[key] ?? defaultVal ?? ''),
    getOrThrow: jest.fn((key: string) => {
      if (config[key] === undefined) throw new Error(`Missing ${key}`);
      return config[key];
    }),
  };
}

/**
 * Sample JWT payload for test user
 */
export const mockUserPayload = {
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  studio_id: '660e8400-e29b-41d4-a716-446655440001',
  role: 'owner',
  roles: [{ role: 'owner', branch_id: null }],
  branch_ids: [],
  branch_id: null,
  email: 'owner@test-gym.com',
  permissions: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    members: { view: true, create: true, edit: true, delete: true },
    payments: { view: true, create: true, edit: true, delete: true },
    classes: { view: true, create: true, edit: true, delete: true },
    staff: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: true },
    ai: { view: true, create: true, edit: true, delete: true },
  },
  permission_codes: [
    'dashboard.view', 'members.view', 'members.create', 'members.edit',
    'members.delete', 'payments.view', 'payments.create', 'classes.view',
    'classes.create', 'classes.edit', 'ai.view', 'ai.create',
  ],
};

/**
 * Sample member data
 */
export const mockMember = {
  id: '770e8400-e29b-41d4-a716-446655440002',
  branch_id: '880e8400-e29b-41d4-a716-446655440003',
  member_code: 'FS-20260315-1234',
  full_name: 'John Doe',
  email: 'john@example.com',
  phone: '+919876543210',
  status: 'active',
  gender: 'male',
  date_of_birth: new Date('1990-05-15'),
  membership_plan_id: '990e8400-e29b-41d4-a716-446655440004',
  membership_start: new Date('2026-01-01'),
  membership_end: new Date('2026-12-31'),
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

/**
 * Sample payment data
 */
export const mockPayment = {
  id: 'aa0e8400-e29b-41d4-a716-446655440005',
  member_id: mockMember.id,
  branch_id: mockMember.branch_id,
  amount: 5000,
  currency: 'INR',
  method: 'cash',
  status: 'paid',
  receipt_number: 'RCP-20260315-5678',
  paid_at: new Date('2026-03-15'),
  created_at: new Date('2026-03-15'),
};

/**
 * Sample class data
 */
export const mockClass = {
  id: 'bb0e8400-e29b-41d4-a716-446655440006',
  branch_id: mockMember.branch_id,
  trainer_id: 'cc0e8400-e29b-41d4-a716-446655440007',
  name: 'Morning Yoga',
  category: 'yoga',
  room: 'Studio A',
  capacity: 20,
  duration_minutes: 60,
  starts_at: new Date('2026-03-20T06:00:00Z'),
  status: 'active',
  created_at: new Date('2026-03-01'),
};
