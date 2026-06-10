import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberDirectoryService } from '../directory/member-directory.service';
import { AppUserService } from '../app-user/app-user.service';
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
 * the verified Supabase token for the app's own member tokens.
 *
 * Public-fitness-platform model: login is open to ANYONE, not just gym members.
 * Every verified phone resolves to an app_user (the canonical person). If that
 * person is also an active gym member (member_directory), the issued token also
 * carries a gym scope (tenantId + memberId); otherwise it is a gym-less PUBLIC
 * session. Reads only public-schema tables, so it needs no tenant context.
 */
@Injectable()
export class MemberAuthService {
  private readonly logger = new Logger(MemberAuthService.name);

  /** Refresh-token lifetime. */
  private readonly refreshTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: MemberDirectoryService,
    private readonly appUsers: AppUserService,
    private readonly supabase: MemberSupabaseAuthService,
    private readonly tokens: MemberTokenService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Whether the dev OTP bypass is active. Hard-gated: OFF whenever
   * NODE_ENV === 'production' (the route then 404s), ON in any other env.
   */
  private get devBypassEnabled(): boolean {
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  /**
   * Optional FIXED dev code (MEMBER_DEV_OTP). When set, the bypass requires
   * exactly this code (legacy behaviour). When unset, the app generates and
   * displays a per-attempt code, so the server accepts any well-formed code.
   */
  private get fixedDevOtp(): string | null {
    const code = (this.config.get<string>('MEMBER_DEV_OTP') ?? '').trim();
    return code.length > 0 ? code : null;
  }

  /**
   * Always returns the same shape — never reveals whether the phone is a member.
   * Public-app model: dispatch to ANYONE (Supabase creates the user if new), so a
   * brand-new person can sign up. Only a malformed phone is skipped.
   */
  async requestOtp(phone: string): Promise<OtpRequestResultData> {
    if (this.directory.normalizePhone(phone)) {
      await this.supabase.requestPhoneOtp(phone);
    }
    return { dispatched: true, channel: 'sms' };
  }

  /**
   * Exchange a verified Supabase token for member tokens. Every verified phone
   * resolves to an app_user; gym membership (if any) is layered on top.
   */
  async createSession(
    supabaseToken: string,
    tenantId?: string,
  ): Promise<SessionResultData> {
    const user = await this.supabase.verifyToken(supabaseToken);
    if (!user) throw MemberException.invalidToken();

    const phone = this.directory.normalizePhone(user.phone);
    if (!phone) throw MemberException.invalidToken('No phone on verified user.');

    const appUser = await this.appUsers.findOrCreate(phone);
    if (!appUser) throw MemberException.invalidToken('Could not resolve account.');

    return this.sessionForAppUser(appUser.id, phone, tenantId);
  }

  /**
   * ⚠️ DEV-ONLY login bypass — issues real member tokens for a phone WITHOUT any
   * SMS/Supabase OTP. Hard-disabled in production (see `devBypassEnabled`). Used
   * so the app can be exercised on machines with no SMS provider configured. The
   * code is generated and shown on the client, so when no FIXED code is set the
   * server only checks the code is well-formed (4–8 digits); set MEMBER_DEV_OTP
   * to require an exact code instead. Still requires the phone to be a real,
   * active member — it does not fabricate identities or bypass tenant resolution.
   */
  async devSession(
    phone: string,
    code: string,
    tenantId?: string,
  ): Promise<SessionResultData> {
    // Bypass off (production) → behave as if the route does not exist.
    if (!this.devBypassEnabled) throw MemberException.notFound();

    const fixed = this.fixedDevOtp;
    const entered = (code ?? '').trim();
    const ok = fixed ? entered === fixed : /^\d{4,8}$/.test(entered);
    if (!ok) throw MemberException.invalidToken('Invalid dev code.');

    const normalized = this.directory.normalizePhone(phone);
    if (!normalized) throw MemberException.notAMember();

    const appUser = await this.appUsers.findOrCreate(normalized);
    if (!appUser) throw MemberException.invalidToken('Could not resolve account.');

    this.logger.warn(
      `DEV OTP bypass used for phone ending …${normalized.slice(-4)} ` +
        `(NODE_ENV=${this.config.get<string>('NODE_ENV') ?? 'unset'})`,
    );
    return this.sessionForAppUser(appUser.id, normalized, tenantId);
  }

  /**
   * Build a session for a resolved app_user: no gym → gym-less PUBLIC tokens;
   * single gym → gym-scoped tokens; multi-gym → either honor an explicit tenant
   * choice or return the gym list to pick from. Always reconciles the person's
   * gym links and bumps last_active_at. Shared by the real (Supabase) and
   * dev-bypass login paths.
   */
  private async sessionForAppUser(
    appUserId: string,
    phone: string,
    tenantId?: string,
  ): Promise<SessionResultData> {
    const entries = await this.directory.resolveByPhone(phone);
    await this.appUsers.syncLinks(appUserId, entries);
    await this.appUsers.touch(appUserId);

    // The chooser is per-gym, but the directory can hold a member more than once
    // in the SAME gym (e.g. duplicate records from different phone formats). Pick
    // one memberId per gym so we neither show a gym twice nor prompt a choice when
    // it's really a single gym.
    const memberByTenant = new Map<string, string>();
    for (const e of entries) {
      if (!memberByTenant.has(e.tenantId)) memberByTenant.set(e.tenantId, e.memberId);
    }
    const tenantIds = [...memberByTenant.keys()];

    // Gym-less PUBLIC user / lead → a session with no gym scope. They can use the
    // public fitness features; gym endpoints 403 (GymMemberGuard).
    if (tenantIds.length === 0) {
      return { tokens: await this.issueTokens(appUserId, null, null) };
    }

    if (tenantId) {
      const memberId = memberByTenant.get(tenantId);
      if (!memberId) throw MemberException.notAMember();
      return { tokens: await this.issueTokens(appUserId, memberId, tenantId) };
    }

    if (tenantIds.length === 1) {
      return {
        tokens: await this.issueTokens(
          appUserId,
          memberByTenant.get(tenantIds[0])!,
          tenantIds[0],
        ),
      };
    }

    const studios = await this.prisma.studio.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(studios.map((s) => [s.id, s.name]));
    return {
      tokens: null,
      tenantChoices: tenantIds.map((id) => ({
        tenantId: id,
        gymName: nameById.get(id) ?? 'Gym',
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

    // Resolve the canonical person. New rows carry app_user_id; LEGACY rows
    // (minted pre-cutover) derive it from the gym member they belong to.
    let appUserId = row.app_user_id;
    if (!appUserId) {
      if (row.member_id && row.tenant_id) {
        appUserId = await this.appUsers.resolveForMember(
          row.tenant_id,
          row.member_id,
        );
      }
      if (!appUserId) {
        throw MemberException.invalidToken('Refresh token cannot be resolved.');
      }
    }

    const pair = await this.issueTokens(appUserId, row.member_id, row.tenant_id);
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

  /**
   * Sign an access token and persist a new (hashed) refresh token. memberId +
   * tenantId are null for a gym-less PUBLIC session; appUserId is always set.
   */
  private async issueTokens(
    appUserId: string,
    memberId: string | null,
    tenantId: string | null,
  ): Promise<TokenPairData> {
    const accessToken = await this.tokens.signAccessToken({
      sub: appUserId,
      appUserId,
      tenantId,
      memberId,
      role: 'member',
    });
    const refresh = this.tokens.generateRefreshToken();
    await this.prisma.memberRefreshToken.create({
      data: {
        app_user_id: appUserId,
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
