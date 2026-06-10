import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberException } from '../common/member-exception';
import type { CurrentMemberContext } from '../decorators/current-member.decorator';
import type {
  MeContextData,
  MeCapabilitiesData,
  MeMembershipData,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER CONTEXT SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Powers GET /me/context — the single call the member app uses to decide which
 * experience to render. It works for EVERY authenticated app user, gym member or
 * gym-less public user, so it is keyed by appUserId (not a gym scope).
 *
 * userType:
 *   public  — 0 gym memberships (a lead)
 *   member  — an active membership in >=1 gym
 *   expired — had a membership, none active now
 *
 * Reads only public-schema app tables + a single read-only cross-gym query for
 * the person's OWN member rows (filtered by their own member ids, which are
 * globally-unique PKs, AND their own tenant ids — no other gym's rows can match).
 */
@Injectable()
export class MemberContextService {
  /** members.status values that count as an active membership. */
  private static readonly ACTIVE_STATUSES = new Set([
    'active',
    'trial',
    'expiring_soon',
    'frozen',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  async getContext(member: CurrentMemberContext): Promise<MeContextData> {
    const appUser = await this.prisma.appUser.findUnique({
      where: { id: member.appUserId },
      select: {
        id: true,
        phone: true,
        full_name: true,
        city: true,
        onboarding_state: true,
        referral_code: true,
      },
    });
    if (!appUser) throw MemberException.notFound('Account not found.');

    const links = await this.prisma.appUserGymLink.findMany({
      where: { app_user_id: member.appUserId },
      select: { tenant_id: true, member_id: true },
    });

    const memberships =
      links.length > 0 ? await this.loadMemberships(links) : [];

    // A membership is "usable" only if it's active AND the gym isn't suspended.
    // suspended = the person has an active membership but every such gym is
    // operator-suspended (a usable gym wins → they stay 'member').
    const anyUsable = memberships.some((m) => m.active && !m.suspended);
    const anyActive = memberships.some((m) => m.active);
    const userType: MeContextData['userType'] =
      memberships.length === 0
        ? 'public'
        : anyUsable
          ? 'member'
          : anyActive
            ? 'suspended'
            : 'expired';

    return {
      appUserId: appUser.id,
      userType,
      onboardingState:
        appUser.onboarding_state as MeContextData['onboardingState'],
      fullName: appUser.full_name,
      phone: appUser.phone,
      city: appUser.city,
      referralCode: appUser.referral_code,
      capabilities: this.capabilitiesFor(userType),
      memberships,
    };
  }

  /**
   * Cross-gym read of the person's own member rows + the most relevant membership
   * (prefer an active one, else the latest). Safe: filtered by the caller's own
   * member ids (unique PKs) and tenant ids — it can only return their records.
   */
  private async loadMemberships(
    links: Array<{ tenant_id: string; member_id: string }>,
  ): Promise<MeMembershipData[]> {
    const memberIds = links.map((l) => l.member_id);
    const tenantIds = links.map((l) => l.tenant_id);

    const rows = await this.prisma.$queryRaw<
      Array<{
        member_id: string;
        tenant_id: string;
        status: string;
        gym_name: string;
        suspended_at: Date | null;
        end_date: Date | null;
        plan_name: string | null;
      }>
    >(Prisma.sql`
      SELECT m.id::text         AS member_id,
             m.gym_id::text     AS tenant_id,
             m.status           AS status,
             s.name             AS gym_name,
             s.suspended_at     AS suspended_at,
             mm.end_date        AS end_date,
             mp.name            AS plan_name
      FROM studio_template.members m
      JOIN public.studios s ON s.id = m.gym_id
      LEFT JOIN LATERAL (
        SELECT x.end_date, x.plan_id
        FROM studio_template.member_memberships x
        WHERE x.member_id = m.id AND x.gym_id = m.gym_id
        ORDER BY (x.status = 'active') DESC, x.end_date DESC NULLS LAST
        LIMIT 1
      ) mm ON true
      LEFT JOIN studio_template.membership_plans mp
        ON mp.id = mm.plan_id AND mp.gym_id = m.gym_id
      WHERE m.id::text IN (${Prisma.join(memberIds)})
        AND m.gym_id::text IN (${Prisma.join(tenantIds)})
    `);

    return rows.map((r) => ({
      tenantId: r.tenant_id,
      gymName: r.gym_name,
      memberId: r.member_id,
      status: r.status,
      active: MemberContextService.ACTIVE_STATUSES.has(r.status),
      suspended: !!r.suspended_at,
      planName: r.plan_name,
      expiresAt: r.end_date
        ? r.end_date.toISOString().slice(0, 10)
        : null,
    }));
  }

  /**
   * The capability matrix the app reads to build navigation + screens. Gym
   * features are hidden for public users; an expired member keeps only the
   * membership-card/subscription view + a Renew CTA; public fitness features are
   * always on.
   */
  private capabilitiesFor(
    userType: MeContextData['userType'],
  ): MeCapabilitiesData {
    const isMember = userType === 'member';
    const isExpired = userType === 'expired';
    const isSuspended = userType === 'suspended';
    const hasGym = isMember || isExpired || isSuspended;

    return {
      // Gym-only features — all OFF when the gym is suspended; the app shows a
      // "gym suspended" banner instead (the BFF also hard-blocks these routes).
      membershipCard: hasGym, // kept so the member can still see the gym + status
      gymSuspended: isSuspended,
      attendance: isMember,
      classBooking: isMember,
      gymSchedule: isMember,
      gymAnnouncements: isMember,
      trainerChat: isMember,
      subscriptionDetails: hasGym,
      memberBenefits: isMember,
      renewMembership: isExpired, // suspension is an operator action, not a renewal
      // Public fitness features (always available)
      healthDashboard: true,
      weightTracking: true,
      waterTracking: true,
      goalTracking: true,
      bmiCalculator: true,
      calorieCalculator: true,
      fitnessTips: true,
      nearbyGyms: true,
      referralProgram: true,
    };
  }
}
