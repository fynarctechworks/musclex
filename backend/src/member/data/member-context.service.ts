import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../../prisma/tenant-task-runner';
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

  constructor(
    private readonly pub: PublicPrismaService, // registry: appUser, appUserGymLink, studio
    private readonly tenant: TenantPrisma, // per-gym member reads inside runForGym
    private readonly tasks: TenantTaskRunner, // resolve+run in each of the caller's own gyms
  ) {}

  async getContext(member: CurrentMemberContext): Promise<MeContextData> {
    const appUser = await this.pub.appUser.findUnique({
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

    const links = await this.pub.appUserGymLink.findMany({
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
   * Read the person's own member rows + most relevant membership (prefer an
   * active one, else the latest). Road B: the cross-tenant studio_template scan
   * is replaced by per-gym reads — group the caller's links by gym, fetch each
   * gym's studio (name/suspended) from the registry, then `runForGym` into that
   * gym's schema to read ONLY the caller's own member rows. N = the gyms the
   * person belongs to (typically 1–3), so the fan-out is negligible.
   */
  private async loadMemberships(
    links: Array<{ tenant_id: string; member_id: string }>,
  ): Promise<MeMembershipData[]> {
    // Group the caller's member ids by gym.
    const byTenant = new Map<string, string[]>();
    for (const l of links) {
      const arr = byTenant.get(l.tenant_id) ?? [];
      arr.push(l.member_id);
      byTenant.set(l.tenant_id, arr);
    }

    // Registry: gym name + suspension flag (one batched query).
    const studios = await this.pub.studio.findMany({
      where: { id: { in: [...byTenant.keys()] } },
      select: { id: true, name: true, suspended_at: true },
    });
    const studioMap = new Map(studios.map((s) => [s.id, s]));

    const out: MeMembershipData[] = [];
    for (const [tenantId, memberIds] of byTenant) {
      const studio = studioMap.get(tenantId);
      if (!studio) continue; // gym not in registry (deleted) — skip

      // Read this gym's own member rows inside its tenant context. runForGym
      // resolves the schema from the registry; returns undefined if the gym has
      // no valid schema (then we skip rather than surface a partial error).
      const members = await this.tasks.runForGym(tenantId, () =>
        this.tenant.client.member.findMany({
          where: { id: { in: memberIds } },
          select: {
            id: true,
            status: true,
            memberships: {
              select: {
                status: true,
                end_date: true,
                plan: { select: { name: true } },
              },
            },
          },
        }),
      );
      if (!members) continue;

      for (const m of members) {
        const best = this.pickBestMembership(m.memberships);
        out.push({
          tenantId,
          gymName: studio.name,
          memberId: m.id,
          status: m.status,
          active: MemberContextService.ACTIVE_STATUSES.has(m.status),
          suspended: !!studio.suspended_at,
          planName: best?.plan?.name ?? null,
          expiresAt: best?.end_date
            ? best.end_date.toISOString().slice(0, 10)
            : null,
        });
      }
    }

    return out;
  }

  /**
   * Pick the most relevant membership for the card: prefer an `active` one, else
   * fall back to all; within the pool take the latest end_date (nulls lowest).
   * Mirrors the old `ORDER BY (status='active') DESC, end_date DESC NULLS LAST`.
   */
  private pickBestMembership(
    memberships: Array<{
      status: string;
      end_date: Date | null;
      plan: { name: string } | null;
    }>,
  ): { end_date: Date | null; plan: { name: string } | null } | null {
    if (memberships.length === 0) return null;
    const active = memberships.filter((x) => x.status === 'active');
    const pool = active.length > 0 ? active : memberships;
    return pool.reduce((a, b) => {
      const ae = a.end_date ? a.end_date.getTime() : -Infinity;
      const be = b.end_date ? b.end_date.getTime() : -Infinity;
      return be > ae ? b : a;
    });
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
