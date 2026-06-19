/**
 * SAFETY NET — PASSWORD RESET (P0-2 account-takeover guard)
 *
 * resetPassword must derive the user id from a SERVER-VERIFIED Supabase recovery
 * token (`supabase.auth.getUser(access_token)`), never from client-supplied
 * input. These tests go RED if a refactor re-introduces the hole where a caller
 * could set any account's password by passing a raw user id.
 */

import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { createMockConfigService } from '../test-utils';

describe('SAFETY-NET / AuthService.resetPassword', () => {
  let service: AuthService;
  let mockSupabase: any;

  beforeEach(() => {
    const noop = () => undefined;
    const prisma: any = {};
    const mockPub: any = {};
    const stub: any = new Proxy({}, { get: () => jest.fn() });

    service = new AuthService(
      createMockConfigService() as any,
      prisma,
      mockPub,
      stub, stub, stub, stub, stub, stub, stub,
      { emit: noop } as any,
      stub, stub, stub,
      { send: jest.fn() } as any,
    );

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        admin: { updateUserById: jest.fn().mockResolvedValue({ error: null }) },
      },
    };
    (service as any).supabase = mockSupabase;
  });

  it('rejects an invalid/expired recovery token and never updates a password', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    await expect(
      service.resetPassword({ access_token: 'forged', new_password: 'NewPass123!' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('derives the user id from the verified token, not from caller input', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'real-user-from-token' } },
      error: null,
    });

    await service.resetPassword({
      access_token: 'valid-recovery-token',
      new_password: 'NewPass123!',
    } as any);

    // Password is set for the token's owner — the access_token is never treated
    // as (or replaced by) a client-supplied user id.
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      'real-user-from-token',
      { password: 'NewPass123!' },
    );
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalledWith(
      'valid-recovery-token',
      expect.anything(),
    );
  });
});
