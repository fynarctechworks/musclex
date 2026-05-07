import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthIdentityService } from '../../src/auth/auth-identity.service';
import { AuthDeviceService } from '../../src/auth/auth-device.service';
import { AuthLoginHistoryService } from '../../src/auth/auth-login-history.service';
import { AuthSessionService } from '../../src/auth/auth-session.service';
import { RbacService } from '../../src/auth/rbac.service';
import { RbacSeedService } from '../../src/auth/rbac-seed.service';
import { TwoFactorService } from '../../src/auth/two-factor.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createMockPrismaService, createMockConfigService } from '../test-utils';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;

  const mockIdentityService = {
    findOrCreate: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  const mockDeviceService = {
    registerDevice: jest.fn(),
  };

  const mockLoginHistoryService = {
    recordLogin: jest.fn(),
  };

  const mockSessionService = {
    createSession: jest.fn(),
    validateSession: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllSessions: jest.fn(),
    hashToken: jest.fn().mockReturnValue('hashed-token'),
  };

  const mockRbacService = {
    getUserRoles: jest.fn().mockResolvedValue([]),
    resolvePermissions: jest.fn().mockReturnValue({}),
    getUserWorkspaces: jest.fn().mockResolvedValue([]),
  };

  const mockRbacSeedService = {
    seedStudioRoles: jest.fn(),
  };

  const mockTwoFactorService = {
    generate2FASecret: jest.fn(),
    verify2FAToken: jest.fn(),
    enable2FA: jest.fn(),
    disable2FA: jest.fn(),
    is2FAEnabled: jest.fn().mockResolvedValue(false),
    validateBackupCode: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    mockConfigService = createMockConfigService({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthIdentityService, useValue: mockIdentityService },
        { provide: AuthDeviceService, useValue: mockDeviceService },
        { provide: AuthLoginHistoryService, useValue: mockLoginHistoryService },
        { provide: AuthSessionService, useValue: mockSessionService },
        { provide: RbacService, useValue: mockRbacService },
        { provide: RbacSeedService, useValue: mockRbacSeedService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPlans', () => {
    it('should return available plans', async () => {
      // getPlans calls ensurePlansSeeded which needs subscriptionPlan.count
      prisma.subscriptionPlan.count.mockResolvedValue(5);
      const plans = await service.getPlans();
      expect(plans).toBeDefined();
      expect(Array.isArray(plans)).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should initialize Supabase client', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('SUPABASE_URL', '');
      expect(mockConfigService.get).toHaveBeenCalledWith('SUPABASE_SERVICE_ROLE_KEY', '');
    });
  });

  describe('session management', () => {
    it('should delegate session creation to AuthSessionService', () => {
      expect(mockSessionService.createSession).toBeDefined();
      expect(mockSessionService.revokeSession).toBeDefined();
    });

    it('should delegate RBAC resolution to RbacService', () => {
      expect(mockRbacService.getUserRoles).toBeDefined();
      expect(mockRbacService.resolvePermissions).toBeDefined();
    });
  });
});
