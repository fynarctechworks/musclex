import { MemberAuthService } from './member-auth.service';
import { MemberException } from '../common/member-exception';

/**
 * Unit tests for the member login flow with all collaborators mocked.
 *
 * Public-fitness-platform model: login is open to ANYONE. Every verified phone
 * resolves to an app_user; gym membership (if any) layers a gym scope on top.
 * Covers OTP dispatch, PUBLIC (gym-less) sessions, single/multi-gym resolution,
 * the new token claim shape, and refresh rotation (incl. legacy rows).
 */
describe('MemberAuthService', () => {
  let prisma: any;
  let directory: any;
  let appUsers: any;
  let supabase: any;
  let tokens: any;
  let config: any;
  let service: MemberAuthService;

  /** Build a ConfigService mock from a plain env map. */
  const configOf = (env: Record<string, string | undefined>): any => ({
    get: jest.fn((key: string) => env[key]),
  });

  beforeEach(() => {
    prisma = {
      memberRefreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt_new' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      studio: { findMany: jest.fn() },
    };
    directory = {
      resolveByPhone: jest.fn().mockResolvedValue([]),
      normalizePhone: jest.fn((p: string) => (p ? p.replace(/[^\d]/g, '') : null)),
    };
    appUsers = {
      findOrCreate: jest
        .fn()
        .mockResolvedValue({ id: 'au1', onboarding_state: 'not_started' }),
      touch: jest.fn().mockResolvedValue(undefined),
      syncLinks: jest.fn().mockResolvedValue(undefined),
      resolveForMember: jest.fn().mockResolvedValue('au1'),
    };
    supabase = {
      requestPhoneOtp: jest.fn().mockResolvedValue(undefined),
      verifyToken: jest.fn(),
    };
    tokens = {
      signAccessToken: jest.fn().mockResolvedValue('access.jwt'),
      generateRefreshToken: jest.fn(() => ({ token: 'newRefresh', hash: 'hash:newRefresh' })),
      hashRefreshToken: jest.fn((t: string) => `hash:${t}`),
      accessTokenTtlSeconds: 900,
    };
    // Default: non-prod (NODE_ENV='test'), no MEMBER_DEV_OTP → dev bypass ON and
    // accepts any well-formed code. Individual tests override the config as needed.
    config = configOf({ NODE_ENV: 'test' });
    service = new MemberAuthService(
      prisma,
      directory,
      appUsers,
      supabase,
      tokens,
      config,
    );
  });

  describe('requestOtp', () => {
    it('dispatches OTP for any well-formed phone (public signup is open)', async () => {
      const res = await service.requestOtp('+919876543210');
      expect(supabase.requestPhoneOtp).toHaveBeenCalledWith('+919876543210');
      expect(res).toEqual({ dispatched: true, channel: 'sms' });
    });

    it('dispatches even for a phone with no gym membership (no enumeration)', async () => {
      const res = await service.requestOtp('+10000000000');
      expect(supabase.requestPhoneOtp).toHaveBeenCalled();
      expect(res).toEqual({ dispatched: true, channel: 'sms' });
    });

    it('skips dispatch for a malformed phone', async () => {
      directory.normalizePhone.mockReturnValueOnce(null);
      const res = await service.requestOtp('not-a-phone');
      expect(supabase.requestPhoneOtp).not.toHaveBeenCalled();
      expect(res).toEqual({ dispatched: true, channel: 'sms' });
    });
  });

  describe('createSession', () => {
    it('rejects an invalid Supabase token', async () => {
      supabase.verifyToken.mockResolvedValue(null);
      await expect(service.createSession('bad')).rejects.toBeInstanceOf(MemberException);
    });

    it('issues a gym-less PUBLIC session when the phone has no membership', async () => {
      supabase.verifyToken.mockResolvedValue({ id: 'u1', phone: '919876543210' });
      directory.resolveByPhone.mockResolvedValue([]);
      const res = await service.createSession('tok');
      expect(res.tokens).toMatchObject({ accessToken: 'access.jwt' });
      // no gym scope on the token
      expect(tokens.signAccessToken).toHaveBeenCalledWith({
        sub: 'au1',
        appUserId: 'au1',
        tenantId: null,
        memberId: null,
        role: 'member',
      });
      expect(appUsers.touch).toHaveBeenCalledWith('au1');
    });

    it('issues gym-scoped tokens for a single-gym member', async () => {
      supabase.verifyToken.mockResolvedValue({ id: 'u1', phone: '919876543210' });
      directory.resolveByPhone.mockResolvedValue([{ memberId: 'm1', tenantId: 't1' }]);
      const res = await service.createSession('tok');
      expect(res.tokens).toEqual({
        accessToken: 'access.jwt',
        refreshToken: 'newRefresh',
        expiresIn: 900,
      });
      expect(tokens.signAccessToken).toHaveBeenCalledWith({
        sub: 'au1',
        appUserId: 'au1',
        tenantId: 't1',
        memberId: 'm1',
        role: 'member',
      });
      expect(appUsers.syncLinks).toHaveBeenCalledWith('au1', [
        { memberId: 'm1', tenantId: 't1' },
      ]);
      expect(prisma.memberRefreshToken.create).toHaveBeenCalled();
    });

    it('returns tenantChoices (no tokens) for a multi-gym member without a choice', async () => {
      supabase.verifyToken.mockResolvedValue({ id: 'u1', phone: '919876543210' });
      directory.resolveByPhone.mockResolvedValue([
        { memberId: 'm1', tenantId: 't1' },
        { memberId: 'm2', tenantId: 't2' },
      ]);
      prisma.studio.findMany.mockResolvedValue([
        { id: 't1', name: 'Gym One' },
        { id: 't2', name: 'Gym Two' },
      ]);
      const res = await service.createSession('tok');
      expect(res.tokens).toBeNull();
      expect(res.tenantChoices).toEqual([
        { tenantId: 't1', gymName: 'Gym One' },
        { tenantId: 't2', gymName: 'Gym Two' },
      ]);
    });

    it('issues tokens for a multi-gym member who picked a valid tenant', async () => {
      supabase.verifyToken.mockResolvedValue({ id: 'u1', phone: '919876543210' });
      directory.resolveByPhone.mockResolvedValue([
        { memberId: 'm1', tenantId: 't1' },
        { memberId: 'm2', tenantId: 't2' },
      ]);
      const res = await service.createSession('tok', 't2');
      expect(tokens.signAccessToken).toHaveBeenCalledWith({
        sub: 'au1',
        appUserId: 'au1',
        tenantId: 't2',
        memberId: 'm2',
        role: 'member',
      });
      expect(res.tokens).not.toBeNull();
    });

    it('rejects a multi-gym member who picked a tenant they do not belong to', async () => {
      supabase.verifyToken.mockResolvedValue({ id: 'u1', phone: '919876543210' });
      directory.resolveByPhone.mockResolvedValue([
        { memberId: 'm1', tenantId: 't1' },
        { memberId: 'm2', tenantId: 't2' },
      ]);
      await expect(service.createSession('tok', 't9')).rejects.toMatchObject({
        code: 'NOT_A_MEMBER',
      });
    });
  });

  describe('devSession (dev OTP bypass)', () => {
    const enable = () =>
      (service = new MemberAuthService(
        prisma,
        directory,
        appUsers,
        supabase,
        tokens,
        configOf({ NODE_ENV: 'development', MEMBER_DEV_OTP: '000000' }),
      ));

    it('is ON by default in non-prod and accepts any well-formed (generated) code', async () => {
      directory.resolveByPhone.mockResolvedValue([{ memberId: 'm1', tenantId: 't1' }]);
      const res = await service.devSession('+919876543210', '481922');
      expect(res.tokens).toMatchObject({ accessToken: 'access.jwt' });
      expect(directory.resolveByPhone).toHaveBeenCalled();
    });

    it('rejects a malformed code under the default (non-prod) bypass', async () => {
      await expect(service.devSession('+919876543210', 'abc')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });

    it('404s when NODE_ENV is production even if MEMBER_DEV_OTP is set', async () => {
      service = new MemberAuthService(
        prisma,
        directory,
        appUsers,
        supabase,
        tokens,
        configOf({ NODE_ENV: 'production', MEMBER_DEV_OTP: '000000' }),
      );
      await expect(service.devSession('+919876543210', '000000')).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('rejects a wrong code', async () => {
      enable();
      await expect(service.devSession('+919876543210', '999999')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });

    it('issues a PUBLIC session for a gym-less phone with the right code', async () => {
      enable();
      directory.resolveByPhone.mockResolvedValue([]);
      const res = await service.devSession('+910000000000', '000000');
      expect(res.tokens).toMatchObject({ accessToken: 'access.jwt' });
      expect(tokens.signAccessToken).toHaveBeenCalledWith({
        sub: 'au1',
        appUserId: 'au1',
        tenantId: null,
        memberId: null,
        role: 'member',
      });
    });

    it('issues tokens for a single-gym member with the right code', async () => {
      enable();
      directory.resolveByPhone.mockResolvedValue([{ memberId: 'm1', tenantId: 't1' }]);
      const res = await service.devSession('+919876543210', '000000');
      expect(res.tokens).toMatchObject({ accessToken: 'access.jwt' });
    });

    it('returns tenantChoices for a multi-gym member, then issues tokens on choice', async () => {
      enable();
      directory.resolveByPhone.mockResolvedValue([
        { memberId: 'm1', tenantId: 't1' },
        { memberId: 'm2', tenantId: 't2' },
      ]);
      prisma.studio.findMany.mockResolvedValue([
        { id: 't1', name: 'Gym One' },
        { id: 't2', name: 'Gym Two' },
      ]);
      const first = await service.devSession('+919876543210', '000000');
      expect(first.tokens).toBeNull();
      expect(first.tenantChoices).toHaveLength(2);

      const second = await service.devSession('+919876543210', '000000', 't2');
      expect(second.tokens).not.toBeNull();
      expect(tokens.signAccessToken).toHaveBeenCalledWith({
        sub: 'au1',
        appUserId: 'au1',
        tenantId: 't2',
        memberId: 'm2',
        role: 'member',
      });
    });
  });

  describe('refresh', () => {
    it('rejects an unknown/expired/revoked token', async () => {
      prisma.memberRefreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('whatever')).rejects.toBeInstanceOf(MemberException);
    });

    it('rotates a new-format (app_user) token and revokes the presented one', async () => {
      prisma.memberRefreshToken.findUnique
        .mockResolvedValueOnce({
          id: 'rt_old',
          app_user_id: 'au1',
          member_id: 'm1',
          tenant_id: 't1',
          revoked_at: null,
          expires_at: new Date(Date.now() + 86_400_000),
        })
        .mockResolvedValueOnce({ id: 'rt_new' });

      const res = await service.refresh('oldRefresh');

      expect(res.accessToken).toBe('access.jwt');
      expect(appUsers.resolveForMember).not.toHaveBeenCalled();
      expect(prisma.memberRefreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt_old' },
        data: expect.objectContaining({ replaced_by: 'rt_new', revoked_at: expect.any(Date) }),
      });
    });

    it('rotates a PUBLIC (gym-less) refresh token', async () => {
      prisma.memberRefreshToken.findUnique
        .mockResolvedValueOnce({
          id: 'rt_pub',
          app_user_id: 'au1',
          member_id: null,
          tenant_id: null,
          revoked_at: null,
          expires_at: new Date(Date.now() + 86_400_000),
        })
        .mockResolvedValueOnce({ id: 'rt_new' });

      await service.refresh('pubRefresh');
      expect(tokens.signAccessToken).toHaveBeenCalledWith({
        sub: 'au1',
        appUserId: 'au1',
        tenantId: null,
        memberId: null,
        role: 'member',
      });
    });

    it('resolves a LEGACY row (no app_user_id) via the gym member', async () => {
      prisma.memberRefreshToken.findUnique
        .mockResolvedValueOnce({
          id: 'rt_legacy',
          app_user_id: null,
          member_id: 'm1',
          tenant_id: 't1',
          revoked_at: null,
          expires_at: new Date(Date.now() + 86_400_000),
        })
        .mockResolvedValueOnce({ id: 'rt_new' });

      await service.refresh('legacyRefresh');
      expect(appUsers.resolveForMember).toHaveBeenCalledWith('t1', 'm1');
    });
  });
});
