/**
 * SAFETY NET — LOGIN
 *
 * These tests guard the wrong-password and account-locked branches of
 * AuthService.login. They mock every collaborator (Supabase, Prisma,
 * sub-services). If a future refactor changes the response shape on
 * invalid credentials, or lets a locked account through, these go RED.
 *
 * NOT a unit test of every login branch — only the two outcomes that
 * would hurt the most in production: a wrong password being accepted,
 * or a locked account being let in anyway.
 */

import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { createMockConfigService } from '../test-utils';

describe('SAFETY-NET / AuthService.login', () => {
  let service: AuthService;
  let mockIdentity: any;
  let mockLoginHistory: any;
  let mockSupabase: any;

  beforeEach(() => {
    mockIdentity = {
      isAccountLocked: jest.fn().mockResolvedValue({ locked: false }),
      recordFailedLogin: jest.fn().mockResolvedValue({ is_locked: false }),
    };

    mockLoginHistory = {
      record: jest.fn().mockResolvedValue(undefined),
      getIpFailedCount: jest.fn().mockResolvedValue(0),
    };

    const mockDevice = { trackDevice: jest.fn().mockResolvedValue({ id: 'dev-1', is_new: false }) };
    const mockSession = {
      createSession: jest.fn().mockResolvedValue('sess-1'),
      hashToken: jest.fn().mockReturnValue('hashed'),
    };
    const mockRbac = {
      getUserWorkspaces: jest.fn().mockResolvedValue([]),
      getUserRoles: jest.fn().mockResolvedValue([]),
      resolvePermissions: jest.fn().mockReturnValue({}),
    };
    const mockRbacSeed = { seedStudioRoles: jest.fn() };
    const mock2fa = {
      generateTempToken: jest.fn().mockResolvedValue('tmp'),
    };
    const mockEvents = { emit: jest.fn() };
    const mockScc = { syncStudio: jest.fn().mockResolvedValue(undefined) };
    const mockSubPolicy = { evaluateForUser: jest.fn() };

    const prisma: any = {
      userIdentity: {
        findUnique: jest.fn().mockResolvedValue({ two_factor_enabled: false }),
      },
    };

    service = new AuthService(
      createMockConfigService() as any,
      prisma,
      mockIdentity,
      mockDevice as any,
      mockLoginHistory,
      mockSession as any,
      mockRbac as any,
      mockRbacSeed as any,
      mock2fa as any,
      mockEvents as any,
      mockScc as any,
      mockSubPolicy as any,
    );

    // Replace the real Supabase client with a controllable stub.
    mockSupabase = {
      auth: {
        signInWithPassword: jest.fn(),
        admin: { updateUserById: jest.fn().mockResolvedValue({ error: null }) },
      },
    };
    (service as any).supabase = mockSupabase;
  });

  it('rejects wrong password with UnauthorizedException', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      service.login({ email: 'owner@test-gym.com', password: 'wrong' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Failed attempt must be recorded — silent failure would defeat the
    // brute-force lockout.
    expect(mockIdentity.recordFailedLogin).toHaveBeenCalledWith('owner@test-gym.com');
    expect(mockLoginHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failure_reason: 'invalid_credentials' }),
    );
  });

  it('rejects a locked account before ever calling Supabase', async () => {
    mockIdentity.isAccountLocked.mockResolvedValue({ locked: true, minutes_remaining: 12 });

    await expect(
      service.login({ email: 'owner@test-gym.com', password: 'anything' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(mockLoginHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'locked' }),
    );
  });

  it('rejects an unconfirmed email with a distinct UnauthorizedException', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email not confirmed' },
    });

    await expect(
      service.login({ email: 'new@test-gym.com', password: 'pw' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Must record an email_not_confirmed reason (not generic 'invalid_credentials')
    // so support can distinguish "didn't verify" from "wrong password".
    expect(mockLoginHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({ failure_reason: 'email_not_confirmed' }),
    );
    // Critically: must NOT count this as a failed attempt — would unfairly
    // lock a user out for never clicking the verify link.
    expect(mockIdentity.recordFailedLogin).not.toHaveBeenCalled();
  });
});
