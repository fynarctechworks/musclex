import { MemberAuthService } from './member-auth.service';
import { MemberException } from '../common/member-exception';

/**
 * Unit tests for the member login flow with all collaborators mocked.
 * Covers OTP non-enumeration, single/multi-gym resolution, and refresh rotation.
 */
describe('MemberAuthService', () => {
  let prisma: any;
  let directory: any;
  let supabase: any;
  let tokens: any;
  let service: MemberAuthService;

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
      resolveByPhone: jest.fn(),
      normalizePhone: jest.fn((p: string) => (p ? p.replace(/[^\d]/g, '') : null)),
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
    service = new MemberAuthService(prisma, directory, supabase, tokens);
  });

  describe('requestOtp', () => {
    it('triggers OTP when the phone maps to a member', async () => {
      directory.resolveByPhone.mockResolvedValue([{ memberId: 'm1', tenantId: 't1' }]);
      const res = await service.requestOtp('+919876543210');
      expect(supabase.requestPhoneOtp).toHaveBeenCalledWith('+919876543210');
      expect(res).toEqual({ dispatched: true, channel: 'sms' });
    });

    it('does NOT trigger OTP for an unknown phone, but returns the same result (no enumeration)', async () => {
      directory.resolveByPhone.mockResolvedValue([]);
      const res = await service.requestOtp('+10000000000');
      expect(supabase.requestPhoneOtp).not.toHaveBeenCalled();
      expect(res).toEqual({ dispatched: true, channel: 'sms' });
    });
  });

  describe('createSession', () => {
    it('rejects an invalid Supabase token', async () => {
      supabase.verifyToken.mockResolvedValue(null);
      await expect(service.createSession('bad')).rejects.toBeInstanceOf(MemberException);
    });

    it('rejects when the phone is not a member', async () => {
      supabase.verifyToken.mockResolvedValue({ id: 'u1', phone: '919876543210' });
      directory.resolveByPhone.mockResolvedValue([]);
      await expect(service.createSession('tok')).rejects.toMatchObject({ code: 'NOT_A_MEMBER' });
    });

    it('issues tokens for a single-gym member', async () => {
      supabase.verifyToken.mockResolvedValue({ id: 'u1', phone: '919876543210' });
      directory.resolveByPhone.mockResolvedValue([{ memberId: 'm1', tenantId: 't1' }]);
      const res = await service.createSession('tok');
      expect(res.tokens).toEqual({
        accessToken: 'access.jwt',
        refreshToken: 'newRefresh',
        expiresIn: 900,
      });
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
        sub: 'm2',
        tenantId: 't2',
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

  describe('refresh', () => {
    it('rejects an unknown/expired/revoked token', async () => {
      prisma.memberRefreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('whatever')).rejects.toBeInstanceOf(MemberException);
    });

    it('rotates: issues a new pair and revokes the presented token', async () => {
      prisma.memberRefreshToken.findUnique
        // 1st: lookup of the presented token
        .mockResolvedValueOnce({
          id: 'rt_old',
          member_id: 'm1',
          tenant_id: 't1',
          revoked_at: null,
          expires_at: new Date(Date.now() + 86_400_000),
        })
        // 2nd: lookup of the freshly-created token to chain replaced_by
        .mockResolvedValueOnce({ id: 'rt_new' });

      const res = await service.refresh('oldRefresh');

      expect(res.accessToken).toBe('access.jwt');
      expect(prisma.memberRefreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt_old' },
        data: expect.objectContaining({ replaced_by: 'rt_new', revoked_at: expect.any(Date) }),
      });
    });
  });
});
