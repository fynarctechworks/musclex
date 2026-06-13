import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberDirectoryService } from '../directory/member-directory.service';

/**
 * ────────────────────────────────────────────────────────────────
 * APP USER SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Owns public.app_users — the canonical, gym-independent person behind the
 * member app. Created/looked up by phone on a verified login, whether or not the
 * person belongs to a gym. Also maintains public.app_user_gym_links (which gyms a
 * person is a member of) from directory resolution, so SCC analytics can segment
 * users without re-running phone normalization.
 *
 * Uses PublicPrismaService: app_users / app_user_gym_links live in the public
 * schema and are NOT tenant models. Resolving a person across gyms is the whole
 * point, so this stays on the registry client (no per-gym schema).
 */
@Injectable()
export class AppUserService {
  private readonly logger = new Logger(AppUserService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly directory: MemberDirectoryService,
  ) {}

  /**
   * Find-or-create the app_user for a verified phone. The phone is stored in its
   * normalized (digits-only) form — deterministic for Supabase E.164 input — so
   * the unique(phone) constraint maps one person to one row across login formats.
   * Returns null only if the phone is unusable.
   */
  async findOrCreate(
    phone: string,
  ): Promise<{ id: string; onboarding_state: string } | null> {
    const normalized = this.directory.normalizePhone(phone);
    if (!normalized) return null;

    const row = await this.pub.appUser.upsert({
      where: { phone: normalized },
      create: { phone: normalized, referral_code: this.genCode() },
      update: {}, // existence check only; profile fields are set via PATCH /me
      select: { id: true, onboarding_state: true, referral_code: true },
    });
    // Backfill a code for any pre-5c row that lacks one.
    if (!row.referral_code) {
      await this.ensureReferralCode(row.id);
    }
    return { id: row.id, onboarding_state: row.onboarding_state };
  }

  /** A short, human-friendly, uppercase referral code. */
  private genCode(): string {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  /** Ensure the app_user has a unique referral code; returns it. */
  async ensureReferralCode(appUserId: string): Promise<string> {
    const existing = await this.pub.appUser.findUnique({
      where: { id: appUserId },
      select: { referral_code: true },
    });
    if (existing?.referral_code) return existing.referral_code;
    for (let i = 0; i < 5; i++) {
      const code = this.genCode();
      try {
        await this.pub.appUser.update({
          where: { id: appUserId },
          data: { referral_code: code },
        });
        return code;
      } catch {
        // unique collision — retry with a new code
      }
    }
    throw new Error('Could not allocate a referral code.');
  }

  /** Register/refresh a push device token for the app_user (Phase 5b). */
  async registerDeviceToken(
    appUserId: string,
    token: string,
    platform?: string,
  ): Promise<void> {
    await this.pub.appUserDeviceToken.upsert({
      where: { token },
      create: {
        app_user_id: appUserId,
        token,
        platform: platform ?? null,
        last_seen_at: new Date(),
      },
      update: {
        app_user_id: appUserId,
        platform: platform ?? null,
        last_seen_at: new Date(),
      },
    });
  }

  async deleteDeviceToken(appUserId: string, token: string): Promise<void> {
    await this.pub.appUserDeviceToken.deleteMany({
      where: { token, app_user_id: appUserId },
    });
  }

  /**
   * Mark a campaign/automation delivery opened or clicked (Phase 7.6 analytics).
   * Scoped to the caller's own delivery row; clicked implies opened.
   */
  async ackDelivery(
    appUserId: string,
    deliveryId: string,
    action: 'opened' | 'clicked',
  ): Promise<void> {
    const now = new Date();
    const data =
      action === 'clicked'
        ? { status: 'clicked', clicked_at: now, opened_at: now }
        : { status: 'opened', opened_at: now };
    await this.pub.appCampaignDelivery.updateMany({
      where: { id: deliveryId, app_user_id: appUserId },
      data,
    });
  }

  /**
   * Apply a referrer's code to this app_user (once, never self). Idempotent: a
   * second call (or self/invalid code) returns applied=false with a reason.
   */
  async applyReferral(
    appUserId: string,
    code: string,
  ): Promise<{ applied: boolean; reason?: string }> {
    const me = await this.pub.appUser.findUnique({
      where: { id: appUserId },
      select: { referred_by_app_user_id: true, referral_code: true },
    });
    if (!me) return { applied: false, reason: 'not_found' };
    if (me.referred_by_app_user_id) return { applied: false, reason: 'already_referred' };

    const normalized = code.trim().toUpperCase();
    if (me.referral_code && normalized === me.referral_code) {
      return { applied: false, reason: 'self' };
    }
    const referrer = await this.pub.appUser.findUnique({
      where: { referral_code: normalized },
      select: { id: true },
    });
    if (!referrer) return { applied: false, reason: 'invalid_code' };

    await this.pub.appUser.update({
      where: { id: appUserId },
      data: {
        referred_by_app_user_id: referrer.id,
        referral_source: 'referral',
      },
    });
    return { applied: true };
  }

  /** Bump last_active_at so segmentation (DAU/WAU/MAU, inactive) is accurate. */
  async touch(appUserId: string): Promise<void> {
    await this.pub.appUser.update({
      where: { id: appUserId },
      data: { last_active_at: new Date() },
    });
  }

  /**
   * Reconcile this person's gym-membership links from directory resolution.
   * Idempotent (upsert per (app_user, tenant)). `entries` may be empty — a
   * public user / lead simply has no links.
   */
  async syncLinks(
    appUserId: string,
    entries: Array<{ tenantId: string; memberId: string }>,
  ): Promise<void> {
    for (const e of entries) {
      try {
        await this.pub.appUserGymLink.upsert({
          where: {
            app_user_id_tenant_id: {
              app_user_id: appUserId,
              tenant_id: e.tenantId,
            },
          },
          create: {
            app_user_id: appUserId,
            tenant_id: e.tenantId,
            member_id: e.memberId,
          },
          update: { member_id: e.memberId },
        });
      } catch (err) {
        this.logger.warn(
          `app_user_gym_link sync failed for ${appUserId}/${e.tenantId}: ` +
            `${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Legacy-refresh path: a refresh token minted before the public-app cutover has
   * no app_user_id, only (tenant_id, member_id). Resolve the owning app_user by
   * the member's directory phone (find-or-create), backfill the link, and return
   * the app_user id so the rotated token carries it. Returns null if the member
   * cannot be located in the directory.
   */
  async resolveForMember(
    tenantId: string,
    memberId: string,
  ): Promise<string | null> {
    const dir = await this.pub.memberDirectory.findUnique({
      where: { tenant_id_member_id: { tenant_id: tenantId, member_id: memberId } },
      select: { phone: true },
    });
    if (!dir?.phone) return null;

    const appUser = await this.findOrCreate(dir.phone);
    if (!appUser) return null;

    await this.syncLinks(appUser.id, [{ tenantId, memberId }]);
    return appUser.id;
  }
}
