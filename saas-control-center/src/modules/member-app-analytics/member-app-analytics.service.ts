import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER APP ANALYTICS SERVICE (Phase 4)
 * ────────────────────────────────────────────────────────────────
 *
 * Global (super-admin) analytics over the public fitness app: registrations,
 * activity (DAU/WAU/MAU), onboarding funnel, user segmentation, leads / CRM, and
 * referral + campaign-audience sizing.
 *
 * Reads the public-schema app tables (app_users, app_user_events,
 * app_user_gym_links) and joins studio_template.members for membership status —
 * all via raw SQL (mirrors AnalyticsService), so SCC's Prisma schema is untouched.
 * `n()` coerces Postgres BIGINT counts (returned as bigint/string) to Number.
 *
 * Segment definitions are the single source documented in
 * docs/public-fitness-platform/ROADMAP.md (Phase 3).
 */
@Injectable()
export class MemberAppAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private n(v: unknown): number {
    return v == null ? 0 : Number(v);
  }

  /** Mask a phone for display: keep country+last4, dot the middle (PII guard). */
  private mask(phone: string | null): string {
    if (!phone) return '—';
    const d = phone.replace(/\D/g, '');
    if (d.length < 6) return '••••';
    return `${d.slice(0, 2)}${'•'.repeat(Math.max(2, d.length - 6))}${d.slice(-4)}`;
  }

  /**
   * Per-user membership state, reused across queries. active_member follows the
   * members.status active set; has_gym = the person belongs to >=1 gym.
   */
  private static readonly UM_CTE = Prisma.sql`
    user_membership AS (
      SELECT
        a.id,
        EXISTS (
          SELECT 1 FROM public.app_user_gym_links l WHERE l.app_user_id = a.id
        ) AS has_gym,
        EXISTS (
          SELECT 1
          FROM public.app_user_gym_links l
          JOIN studio_template.members m
            ON m.id = l.member_id AND m.gym_id = l.tenant_id
          WHERE l.app_user_id = a.id
            AND m.status IN ('active','trial','expiring_soon','frozen')
        ) AS active_member
      FROM public.app_users a
    )`;

  // ── Overview KPIs ────────────────────────────────────────────────
  async overview() {
    const [base] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public.app_users) AS total_registrations,
        (SELECT count(*) FROM public.app_users WHERE last_active_at > now() - interval '1 day') AS dau,
        (SELECT count(*) FROM public.app_users WHERE last_active_at > now() - interval '7 day') AS wau,
        (SELECT count(*) FROM public.app_users WHERE last_active_at > now() - interval '30 day') AS mau,
        (SELECT count(DISTINCT app_user_id) FROM public.app_user_events WHERE event_type = 'first_app_open') AS first_opens,
        (SELECT count(*) FROM public.app_users WHERE onboarding_state IN ('in_progress','completed')) AS onboarding_started,
        (SELECT count(*) FROM public.app_users WHERE onboarding_state = 'completed') AS onboarding_completed,
        (SELECT count(*) FROM public.app_users WHERE created_at >= date_trunc('day', now())) AS new_today,
        (SELECT count(*) FROM public.app_users WHERE created_at >= date_trunc('week', now())) AS new_week,
        (SELECT count(*) FROM public.app_users WHERE created_at >= date_trunc('month', now())) AS new_month
    `);

    const [mem] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH ${MemberAppAnalyticsService.UM_CTE}
      SELECT
        count(*) FILTER (WHERE active_member) AS with_membership,
        count(*) FILTER (WHERE has_gym AND NOT active_member) AS expired,
        count(*) FILTER (WHERE NOT has_gym) AS without_membership
      FROM user_membership
    `);

    const started = this.n(base.onboarding_started);
    const completed = this.n(base.onboarding_completed);

    const totalReg = this.n(base.total_registrations);
    const withMembership = this.n(mem.with_membership);
    const dau = this.n(base.dau);
    const mau = this.n(base.mau);
    const pct = (num: number, den: number) =>
      den > 0 ? Math.round((num / den) * 100) : 0;

    return {
      totalRegistrations: totalReg,
      // Real install counts need store-console data; first_app_open is the proxy.
      firstOpens: this.n(base.first_opens),
      dau,
      wau: this.n(base.wau),
      mau,
      onboardingStarted: started,
      onboardingCompleted: completed,
      completionPct: started > 0 ? Math.round((completed / started) * 100) : 0,
      withMembership,
      withoutMembership: this.n(mem.without_membership),
      expired: this.n(mem.expired),
      newToday: this.n(base.new_today),
      newThisWeek: this.n(base.new_week),
      newThisMonth: this.n(base.new_month),
      // ── Executive rates (Phase 7.10) ──
      onboardingCompletionRate: pct(completed, totalReg), // of all registrations
      membershipConversionRate: pct(withMembership, totalReg),
      stickiness: pct(dau, mau), // DAU/MAU
    };
  }

  // ── Segmentation ─────────────────────────────────────────────────
  async segments() {
    const [r] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH ${MemberAppAnalyticsService.UM_CTE},
      seg AS (
        SELECT
          um.id,
          um.active_member,
          um.has_gym,
          a.last_active_at,
          a.created_at,
          (SELECT count(DISTINCT date_trunc('day', e.occurred_at))
             FROM public.app_user_events e
            WHERE e.app_user_id = a.id
              AND e.occurred_at > now() - interval '14 day') AS active_days_14
        FROM user_membership um
        JOIN public.app_users a ON a.id = um.id
      )
      SELECT
        count(*) FILTER (WHERE active_member) AS member,
        count(*) FILTER (WHERE has_gym AND NOT active_member) AS expired,
        count(*) FILTER (WHERE NOT has_gym) AS public,
        count(*) FILTER (WHERE last_active_at IS NULL OR last_active_at < now() - interval '30 day') AS inactive,
        count(*) FILTER (WHERE active_days_14 >= 3) AS high_engagement
      FROM seg
    `);
    const member = this.n(r.member);
    const expired = this.n(r.expired);
    const publicUsers = this.n(r.public);
    return {
      // Lead = the CRM view of a Public user (same set) — surfaced explicitly.
      segments: [
        { key: 'public', label: 'Public', count: publicUsers },
        { key: 'member', label: 'Gym Members', count: member },
        { key: 'expired', label: 'Expired Members', count: expired },
        { key: 'lead', label: 'Leads', count: publicUsers },
        { key: 'inactive', label: 'Inactive', count: this.n(r.inactive) },
        { key: 'high_engagement', label: 'High Engagement', count: this.n(r.high_engagement) },
      ],
      total: member + expired + publicUsers,
    };
  }

  // ── Conversion funnel ────────────────────────────────────────────
  async funnel() {
    const [r] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public.app_users) AS registered,
        (SELECT count(*) FROM public.app_users WHERE onboarding_state IN ('in_progress','completed')) AS onboarding_started,
        (SELECT count(*) FROM public.app_users WHERE onboarding_state = 'completed') AS onboarding_completed,
        (SELECT count(DISTINCT app_user_id) FROM public.app_user_events WHERE event_type = 'viewed_nearby_gyms') AS viewed_nearby_gyms,
        (SELECT count(DISTINCT app_user_id) FROM public.app_user_events WHERE event_type = 'viewed_gym_profile') AS viewed_gym_profile,
        (SELECT count(DISTINCT app_user_id) FROM public.app_user_gym_links) AS membership_purchased
    `);
    const steps = [
      { key: 'registered', label: 'Registered', count: this.n(r.registered) },
      { key: 'onboarding_started', label: 'Onboarding Started', count: this.n(r.onboarding_started) },
      { key: 'onboarding_completed', label: 'Onboarding Completed', count: this.n(r.onboarding_completed) },
      { key: 'viewed_nearby_gyms', label: 'Viewed Nearby Gyms', count: this.n(r.viewed_nearby_gyms) },
      { key: 'viewed_gym_profile', label: 'Viewed Gym Profile', count: this.n(r.viewed_gym_profile) },
      { key: 'membership_purchased', label: 'Joined a Gym', count: this.n(r.membership_purchased) },
    ];
    const top = steps[0].count || 1;
    return {
      steps: steps.map((s, i) => ({
        ...s,
        pctOfTop: Math.round((s.count / top) * 100),
        pctOfPrev: i === 0 ? 100 : Math.round((s.count / (steps[i - 1].count || 1)) * 100),
      })),
    };
  }

  // ── Leads (no membership) + CRM (all) shared list ────────────────
  /** type: 'leads' = users with no gym; 'crm' = everyone. */
  async users(opts: {
    type: 'leads' | 'crm';
    search?: string;
    city?: string;
    page?: number;
    limit?: number;
    all?: boolean; // export: ignore pagination (bounded)
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = opts.all ? 10000 : Math.min(Math.max(opts.limit ?? 25, 1), 100);
    const offset = (page - 1) * limit;

    const conds: Prisma.Sql[] = [];
    if (opts.type === 'leads') conds.push(Prisma.sql`NOT um.has_gym`);
    if (opts.search) {
      const like = `%${opts.search}%`;
      conds.push(
        Prisma.sql`(a.full_name ILIKE ${like} OR a.phone ILIKE ${like} OR a.city ILIKE ${like})`,
      );
    }
    if (opts.city) conds.push(Prisma.sql`a.city ILIKE ${opts.city}`);
    const where = conds.length
      ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH ${MemberAppAnalyticsService.UM_CTE}
      SELECT
        a.id, a.full_name, a.phone, a.city, a.referral_source,
        a.onboarding_state, a.created_at, a.last_active_at,
        um.has_gym, um.active_member,
        (SELECT count(*) FROM public.app_user_events e WHERE e.app_user_id = a.id) AS event_count,
        (SELECT s.name
           FROM public.app_user_gym_links l
           JOIN public.studios s ON s.id = l.tenant_id
          WHERE l.app_user_id = a.id
          ORDER BY l.created_at DESC LIMIT 1) AS gym_name
      FROM public.app_users a
      JOIN user_membership um ON um.id = a.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const [{ total }] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH ${MemberAppAnalyticsService.UM_CTE}
      SELECT count(*) AS total
      FROM public.app_users a
      JOIN user_membership um ON um.id = a.id
      ${where}
    `);

    const items = rows.map((r) => ({
      id: r.id,
      name: r.full_name ?? '—',
      phone: this.mask(r.phone),
      city: r.city ?? '—',
      registeredAt: r.created_at,
      lastActiveAt: r.last_active_at,
      onboardingStatus: r.onboarding_state,
      referralSource: r.referral_source ?? 'organic',
      gymName: r.gym_name ?? null,
      membershipStatus: r.active_member ? 'member' : r.has_gym ? 'expired' : 'lead',
      usage: this.usageBucket(r.last_active_at, this.n(r.event_count)),
    }));

    return { items, total: this.n(total), page, limit };
  }

  private usageBucket(lastActive: Date | null, events: number): string {
    if (!lastActive) return 'dormant';
    const days = (Date.now() - new Date(lastActive).getTime()) / 86_400_000;
    if (days <= 7 && events >= 5) return 'high';
    if (days <= 7) return 'active';
    if (days <= 30) return 'recent';
    return 'dormant';
  }

  async exportLeadsCsv(search?: string, city?: string): Promise<string> {
    const { items } = await this.users({ type: 'leads', search, city, all: true });
    const head = [
      'Name', 'Phone', 'City', 'Registered', 'Last Active',
      'Onboarding', 'Usage', 'Referral Source', 'Nearest Gym',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = items.map((i) =>
      [
        i.name, i.phone, i.city,
        i.registeredAt ? new Date(i.registeredAt).toISOString().slice(0, 10) : '',
        i.lastActiveAt ? new Date(i.lastActiveAt).toISOString().slice(0, 10) : '',
        i.onboardingStatus, i.usage, i.referralSource, i.gymName ?? '',
      ].map(esc).join(','),
    );
    return [head.map(esc).join(','), ...lines].join('\n');
  }

  // ── Referral analytics (app-user acquisition source) ─────────────
  async referrals() {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH ${MemberAppAnalyticsService.UM_CTE}
      SELECT
        COALESCE(NULLIF(a.referral_source, ''), 'organic') AS source,
        count(*) AS registrations,
        count(*) FILTER (WHERE um.active_member) AS conversions
      FROM public.app_users a
      JOIN user_membership um ON um.id = a.id
      GROUP BY 1
      ORDER BY registrations DESC
    `);
    return {
      sources: rows.map((r) => ({
        source: r.source,
        registrations: this.n(r.registrations),
        conversions: this.n(r.conversions),
        conversionPct:
          this.n(r.registrations) > 0
            ? Math.round((this.n(r.conversions) / this.n(r.registrations)) * 100)
            : 0,
      })),
    };
  }

  // ── Referral chain (Phase 5c) ────────────────────────────────────
  async referralChain() {
    const [totals] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH ${MemberAppAnalyticsService.UM_CTE}
      SELECT
        (SELECT count(DISTINCT app_user_id) FROM public.app_user_events WHERE event_type = 'referral_share') AS shares,
        (SELECT count(*) FROM public.app_users WHERE referred_by_app_user_id IS NOT NULL) AS referred_registrations,
        (SELECT count(*) FROM public.app_users a
           JOIN user_membership um ON um.id = a.id
          WHERE a.referred_by_app_user_id IS NOT NULL AND um.active_member) AS referred_conversions
    `);
    const topReferrers = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH ${MemberAppAnalyticsService.UM_CTE}
      SELECT
        r.id, COALESCE(NULLIF(r.full_name, ''), 'App user') AS name,
        r.referral_code,
        count(ref.id) AS referrals,
        count(ref.id) FILTER (WHERE um.active_member) AS conversions
      FROM public.app_users r
      JOIN public.app_users ref ON ref.referred_by_app_user_id = r.id
      JOIN user_membership um ON um.id = ref.id
      GROUP BY r.id, r.full_name, r.referral_code
      ORDER BY referrals DESC
      LIMIT 20
    `);
    // Revenue attributed to referred users who became active members.
    const [rev] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT COALESCE(SUM(mp.price), 0)::float AS revenue
      FROM public.app_users a
      JOIN public.app_user_gym_links l ON l.app_user_id = a.id
      JOIN studio_template.member_memberships mm
        ON mm.member_id = l.member_id AND mm.gym_id = l.tenant_id AND mm.status = 'active'
      JOIN studio_template.membership_plans mp
        ON mp.id = mm.plan_id AND mp.gym_id = l.tenant_id
      WHERE a.referred_by_app_user_id IS NOT NULL
    `);
    const referredRegistrations = this.n(totals.referred_registrations);
    const referredConversions = this.n(totals.referred_conversions);

    return {
      shares: this.n(totals.shares),
      referredRegistrations,
      referredConversions,
      referralConversionRate:
        referredRegistrations > 0
          ? Math.round((referredConversions / referredRegistrations) * 100)
          : 0,
      revenue: this.n(rev?.revenue),
      topReferrers: topReferrers.map((r) => ({
        name: r.name,
        referralCode: r.referral_code,
        referrals: this.n(r.referrals),
        conversions: this.n(r.conversions),
      })),
    };
  }

  // ── Campaign audience sizing (targets for Phase-5 sends) ─────────
  async campaignAudiences() {
    const { segments } = await this.segments();
    const reachable = new Set(['public', 'member', 'expired', 'lead', 'inactive']);
    return {
      audiences: segments
        .filter((s) => reachable.has(s.key))
        .map((s) => ({ segment: s.key, label: s.label, size: s.count })),
      note: 'Segment-targeted sends ship in Phase 5; these are addressable audience sizes.',
    };
  }

  // ── Registration growth (last N days) ────────────────────────────
  async growth(days = 30) {
    const d = Math.min(Math.max(days, 7), 365);
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      WITH series AS (
        SELECT generate_series(
          date_trunc('day', now()) - (${d - 1} || ' days')::interval,
          date_trunc('day', now()),
          '1 day'::interval
        )::date AS day
      )
      SELECT to_char(s.day, 'YYYY-MM-DD') AS day,
             count(a.id) AS registrations
      FROM series s
      LEFT JOIN public.app_users a
        ON a.created_at >= s.day AND a.created_at < s.day + interval '1 day'
      GROUP BY s.day ORDER BY s.day
    `);
    return { points: rows.map((r) => ({ day: r.day, registrations: this.n(r.registrations) })) };
  }
}
