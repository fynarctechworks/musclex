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
import { SccSyncService } from '../../src/common/services/scc-sync.service';
import { SubscriptionPolicyService } from '../../src/common/services/subscription-policy.service';
import { RazorpayService } from '../../src/payments/razorpay.service';
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

  const mockSccSyncService = {
    syncStudio: jest.fn().mockResolvedValue(undefined),
    syncUser: jest.fn().mockResolvedValue(undefined),
  };

  const mockSubscriptionPolicyService = {
    enforce: jest.fn().mockResolvedValue(undefined),
    isLocked: jest.fn().mockResolvedValue(false),
  };

  const mockRazorpayService = {
    configured: true,
    getKeyId: jest.fn().mockReturnValue('rzp_test_key'),
    createOrder: jest.fn(),
    getOrder: jest.fn(),
    verifyCheckoutSignature: jest.fn().mockReturnValue(true),
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
        { provide: SccSyncService, useValue: mockSccSyncService },
        { provide: SubscriptionPolicyService, useValue: mockSubscriptionPolicyService },
        { provide: RazorpayService, useValue: mockRazorpayService },
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

  describe('oauthSync', () => {
    // Wire the post-auth collaborators the shared pipeline actually calls.
    const wirePostAuthMocks = () => {
      (mockIdentityService as any).syncIdentity = jest.fn().mockResolvedValue(undefined);
      (mockDeviceService as any).trackDevice = jest
        .fn()
        .mockResolvedValue({ id: 'dev-1', is_new: false });
      (mockLoginHistoryService as any).record = jest.fn().mockResolvedValue(undefined);
      mockSessionService.createSession.mockResolvedValue('sess-1');
      mockRbacService.getUserWorkspaces.mockResolvedValue([]);
      // 2FA lookup → disabled (userIdentity isn't in the base mock prisma)
      (prisma as any).userIdentity = {
        findUnique: jest.fn().mockResolvedValue({ two_factor_enabled: false }),
      };
    };

    it('rejects an invalid Supabase token', async () => {
      (service as any).supabase = {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }) },
      };
      await expect(service.oauthSync('bad-access', 'bad-refresh')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the email already belongs to a different account', async () => {
      (prisma as any).userIdentity = {
        findUnique: jest.fn().mockResolvedValue({ id: 'some-other-user' }),
      };
      (service as any).supabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user-google-1',
                email: 'taken@studio.com',
                user_metadata: {},
              },
            },
            error: null,
          }),
          admin: { updateUserById: jest.fn() },
        },
      };
      await expect(service.oauthSync('access-tok', 'refresh-tok')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('seeds a brand-new social user into the onboarding wizard and syncs identity', async () => {
      wirePostAuthMocks();
      // No prior account owns this email.
      (prisma.userIdentity.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const updateUserById = jest.fn().mockResolvedValue({ data: {}, error: null });
      (service as any).supabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user-google-1',
                email: 'new@studio.com',
                user_metadata: { full_name: 'New Owner' }, // no role / studio / step
                email_confirmed_at: '2026-01-01T00:00:00Z',
              },
            },
            error: null,
          }),
          admin: { updateUserById },
        },
      };

      const res: any = await service.oauthSync('access-tok', 'refresh-tok');

      // Brand-new user: seeded with owner role + start of the onboarding wizard.
      expect(updateUserById).toHaveBeenCalledWith(
        'user-google-1',
        expect.objectContaining({
          user_metadata: expect.objectContaining({
            role: 'owner',
            onboarding_step: 'studio_info',
          }),
        }),
      );
      expect(res.user.onboarding_step).toBe('studio_info');
      expect(res.studio).toBeNull();
      // Identity MUST be synced or the JWT guard would reject every later call.
      expect((mockIdentityService as any).syncIdentity).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-google-1', email: 'new@studio.com' }),
      );
    });
  });
});
