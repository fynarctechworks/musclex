import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberDirectoryService } from '../directory/member-directory.service';
import { MemberSupabaseAuthService } from './member-supabase-auth.service';
import { MemberTokenService } from './member-token.service';
import { MemberException } from '../common/member-exception';
import type {
  OtpRequestResultData,
  SessionResultData,
  TokenPairData,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER AUTH SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Implements the login flow (Checklist §1.2): phone → Supabase OTP → exchange
 * the verified Supabase token for the app's own member tokens. Reads only
 * public-schema tables (member_directory, studios, member_refresh_tokens), so
 * it needs no tenant context.
 */
@Injectable()
export class MemberAuthService {
  /** Refresh-token lifetime. */
  private readonly refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: MemberDirectoryService,
    private readonly supabase: MemberSupabaseAuthService,
    private readonly tokens: MemberTokenService,
  ) {}

  /** Always returns the same shape — never reveals whether the phone is a member. */
  async requestOtp(phone: string): Promise<OtpRequestResultData> {
    const entries = await this.directory.resolveByPhone(phone);
    if (entries.length > 0) {
      await this.supabase.requestPhoneOtp(phone);
    }
    return { dispatched: true, channel: 'sms' };
  }

  /**
   * Exchange a verified Supabase token for member tokens. Resolves the member
   * via the directory using the phone on the verified Supabase user.
   */
  async createSession(
    supabaseToken: string,
    tenantId?: string,
  ): Promise<SessionResultData> {
    const user = await this.supabase.verifyToken(supabaseToken);
    if (!user) throw MemberException.invalidToken();

    const phone = this.directory.normalizePhone(user.phone);
    if (!phone) throw MemberException.notAMember();

    const entries = await this.directory.resolveByPhone(phone);
    if (entries.length === 0) throw MemberException.notAMember();

    if (entries.length === 1) {
      return { tokens: await this.issueTokens(entries[0].memberId, entries[0].tenantId) };
    }

    // Multi-gym member: require an explicit, valid tenant choice.
    if (tenantId) {
      const chosen = entries.find((e) => e.tenantId === tenantId);
      if (!chosen) throw MemberException.notAMember();
      return { tokens: await this.issueTokens(chosen.memberId, chosen.tenantId) };
    }

    const studios = await this.prisma.studio.findMany({
      where: { id: { in: entries.map((e) => e.tenantId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(studios.map((s) => [s.id, s.name]));
    return {
      tokens: null,
      tenantChoices: entries.map((e) => ({
        tenantId: e.tenantId,
        gymName: nameById.get(e.tenantId) ?? 'Gym',
      })),
    };
  }

  /** Rotate a refresh token: validate, revoke the old, issue a fresh pair. */
  async refresh(refreshToken: string): Promise<TokenPairData> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const row = await this.prisma.memberRefreshToken.findUnique({
      where: { token_hash: hash },
    });
    if (!row || row.revoked_at || row.expires_at.getTime() < Date.now()) {
      throw MemberException.invalidToken('Refresh token is invalid or expired.');
    }

    const pair = await this.issueTokens(row.member_id, row.tenant_id);
    const created = await this.prisma.memberRefreshToken.findUnique({
      where: { token_hash: this.tokens.hashRefreshToken(pair.refreshToken) },
      select: { id: true },
    });
    await this.prisma.memberRefreshToken.update({
      where: { id: row.id },
      data: { revoked_at: new Date(), replaced_by: created?.id ?? null },
    });
    return pair;
  }

  /** Sign an access token and persist a new (hashed) refresh token. */
  private async issueTokens(
    memberId: string,
    tenantId: string,
  ): Promise<TokenPairData> {
    const accessToken = await this.tokens.signAccessToken({
      sub: memberId,
      tenantId,
      role: 'member',
    });
    const refresh = this.tokens.generateRefreshToken();
    await this.prisma.memberRefreshToken.create({
      data: {
        member_id: memberId,
        tenant_id: tenantId,
        token_hash: refresh.hash,
        expires_at: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: this.tokens.accessTokenTtlSeconds,
    };
  }
}
