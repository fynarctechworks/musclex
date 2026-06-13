import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { JwtPayload } from '../common';

export interface SegmentMemberSample {
  id: string;
  name: string;
  photo_url: string | null;
  signal: string;
}

export interface Segment {
  count: number;
  members_at_risk_amount?: number;
  sample: SegmentMemberSample[];
}

export interface SegmentsResponse {
  high_value: Segment;
  frequent_visitors: Segment;
  low_engagement: Segment;
  recently_joined: Segment;
  recently_cancelled: Segment;
  inactive: Segment;
  generated_at: string;
}

const SAMPLE_LIMIT = 5;

@Injectable()
export class SegmentService {
  constructor(private tenant: TenantPrisma) {}

  private getBranchFilter(user?: JwtPayload, branchId?: string) {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  async getSegments(
    user: JwtPayload,
    branchId?: string,
  ): Promise<SegmentsResponse> {
    const branchFilter = this.getBranchFilter(user, branchId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400000);

    const [
      highValue,
      frequent,
      lowEngagement,
      recentlyJoined,
      recentlyCancelled,
      inactive,
    ] = await Promise.all([
      this.computeHighValue(branchFilter),
      this.computeFrequent(branchFilter, thirtyDaysAgo),
      this.computeLowEngagement(branchFilter, thirtyDaysAgo),
      this.computeRecentlyJoined(branchFilter, fourteenDaysAgo),
      this.computeRecentlyCancelled(branchFilter, thirtyDaysAgo),
      this.computeInactive(branchFilter, twentyOneDaysAgo),
    ]);

    return {
      high_value: highValue,
      frequent_visitors: frequent,
      low_engagement: lowEngagement,
      recently_joined: recentlyJoined,
      recently_cancelled: recentlyCancelled,
      inactive: inactive,
      generated_at: new Date().toISOString(),
    };
  }

  private async computeHighValue(
    branchFilter: Record<string, unknown>,
  ): Promise<Segment> {
    // Lifetime paid totals per member.
    const totals = await this.tenant.client.payment.groupBy({
      by: ['member_id'],
      where: { status: 'paid', ...branchFilter },
      _sum: { amount: true },
    });

    if (totals.length === 0) {
      return { count: 0, sample: [] };
    }

    const sorted = totals
      .map((t) => ({ member_id: t.member_id, total: Number(t._sum.amount ?? 0) }))
      .sort((a, b) => b.total - a.total);

    const cutoffIndex = Math.max(1, Math.ceil(sorted.length * 0.1));
    const top = sorted.slice(0, cutoffIndex);
    const sampleIds = top.slice(0, SAMPLE_LIMIT).map((t) => t.member_id);
    const members = sampleIds.length
      ? await this.tenant.client.member.findMany({
          where: { id: { in: sampleIds }, ...branchFilter },
          select: { id: true, full_name: true, profile_photo_url: true },
        })
      : [];
    const lookup = new Map(members.map((m) => [m.id, m]));
    const sample: SegmentMemberSample[] = top
      .slice(0, SAMPLE_LIMIT)
      .map((t) => {
        const m = lookup.get(t.member_id);
        return {
          id: t.member_id,
          name: m?.full_name ?? '—',
          photo_url: m?.profile_photo_url ?? null,
          signal: `Lifetime spend ₹${t.total.toLocaleString('en-IN')}`,
        };
      })
      .filter((s) => s.name !== '—');

    return {
      count: top.length,
      sample,
    };
  }

  private async computeFrequent(
    branchFilter: Record<string, unknown>,
    thirtyDaysAgo: Date,
  ): Promise<Segment> {
    // Members with check-ins in last 30d, group by member, threshold (~4/week × ~4w = 16).
    const grouped = await this.tenant.client.checkIn.groupBy({
      by: ['member_id'],
      where: {
        status: 'success',
        checked_in_at: { gte: thirtyDaysAgo },
        ...branchFilter,
      },
      _count: { _all: true },
    });
    const FREQUENT_THRESHOLD = 16; // ≥4/week × 4 weeks
    const frequent = grouped.filter((g) => g._count._all >= FREQUENT_THRESHOLD);

    const sampleIds = frequent.slice(0, SAMPLE_LIMIT).map((g) => g.member_id);
    const members = sampleIds.length
      ? await this.tenant.client.member.findMany({
          where: { id: { in: sampleIds } },
          select: { id: true, full_name: true, profile_photo_url: true },
        })
      : [];
    const lookup = new Map(members.map((m) => [m.id, m]));
    const sample: SegmentMemberSample[] = frequent
      .slice(0, SAMPLE_LIMIT)
      .map((g) => {
        const m = lookup.get(g.member_id);
        return {
          id: g.member_id,
          name: m?.full_name ?? '—',
          photo_url: m?.profile_photo_url ?? null,
          signal: `${g._count._all} check-ins / 30d`,
        };
      });

    return { count: frequent.length, sample };
  }

  private async computeLowEngagement(
    branchFilter: Record<string, unknown>,
    thirtyDaysAgo: Date,
  ): Promise<Segment> {
    // Active members with <2 check-ins in last 30d.
    const activeMembers = await this.tenant.client.member.findMany({
      where: { status: 'active', ...branchFilter },
      select: { id: true, full_name: true, profile_photo_url: true },
    });

    if (activeMembers.length === 0) {
      return { count: 0, sample: [] };
    }

    const memberIds = activeMembers.map((m) => m.id);
    const counts = await this.tenant.client.checkIn.groupBy({
      by: ['member_id'],
      where: {
        member_id: { in: memberIds },
        status: 'success',
        checked_in_at: { gte: thirtyDaysAgo },
      },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.member_id, c._count._all]));

    const low = activeMembers.filter((m) => (countMap.get(m.id) ?? 0) < 2);

    // Estimate revenue at risk: sum of paid_at within last 30d for these members
    // (approximation of monthly recurring at risk).
    const atRiskRevenue = low.length
      ? await this.tenant.client.payment.aggregate({
          where: {
            member_id: { in: low.map((m) => m.id) },
            status: 'paid',
            paid_at: { gte: thirtyDaysAgo },
          },
          _sum: { amount: true },
        })
      : { _sum: { amount: 0 } };

    const sample: SegmentMemberSample[] = low.slice(0, SAMPLE_LIMIT).map((m) => ({
      id: m.id,
      name: m.full_name,
      photo_url: m.profile_photo_url ?? null,
      signal: `${countMap.get(m.id) ?? 0} check-ins / 30d`,
    }));

    return {
      count: low.length,
      members_at_risk_amount: Number(atRiskRevenue._sum.amount ?? 0),
      sample,
    };
  }

  private async computeRecentlyJoined(
    branchFilter: Record<string, unknown>,
    fourteenDaysAgo: Date,
  ): Promise<Segment> {
    const recent = await this.tenant.client.member.findMany({
      where: {
        created_at: { gte: fourteenDaysAgo },
        ...branchFilter,
      },
      select: {
        id: true,
        full_name: true,
        profile_photo_url: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const sample: SegmentMemberSample[] = recent
      .slice(0, SAMPLE_LIMIT)
      .map((m) => ({
        id: m.id,
        name: m.full_name,
        photo_url: m.profile_photo_url ?? null,
        signal: `Joined ${this.relativeDays(m.created_at)}`,
      }));

    return { count: recent.length, sample };
  }

  private async computeRecentlyCancelled(
    branchFilter: Record<string, unknown>,
    thirtyDaysAgo: Date,
  ): Promise<Segment> {
    const cancelled = await this.tenant.client.memberMembership.findMany({
      where: {
        status: { in: ['cancelled', 'expired'] },
        updated_at: { gte: thirtyDaysAgo },
        ...branchFilter,
      },
      select: {
        member_id: true,
        end_date: true,
        updated_at: true,
        status: true,
        member: {
          select: { id: true, full_name: true, profile_photo_url: true },
        },
      },
      orderBy: { updated_at: 'desc' },
      distinct: ['member_id'],
    });

    const sample: SegmentMemberSample[] = cancelled
      .slice(0, SAMPLE_LIMIT)
      .map((c) => ({
        id: c.member.id,
        name: c.member.full_name,
        photo_url: c.member.profile_photo_url ?? null,
        signal: `${c.status === 'cancelled' ? 'Cancelled' : 'Expired'} ${this.relativeDays(c.updated_at)}`,
      }));

    return { count: cancelled.length, sample };
  }

  private async computeInactive(
    branchFilter: Record<string, unknown>,
    twentyOneDaysAgo: Date,
  ): Promise<Segment> {
    const inactive = await this.tenant.client.member.findMany({
      where: {
        status: 'active',
        check_ins: {
          none: { checked_in_at: { gte: twentyOneDaysAgo } },
        },
        ...branchFilter,
      },
      select: {
        id: true,
        full_name: true,
        profile_photo_url: true,
        last_visit_at: true,
      },
      take: 500,
    });

    const sample: SegmentMemberSample[] = inactive
      .slice(0, SAMPLE_LIMIT)
      .map((m) => ({
        id: m.id,
        name: m.full_name,
        photo_url: m.profile_photo_url ?? null,
        signal: m.last_visit_at
          ? `Last visit ${this.relativeDays(m.last_visit_at)}`
          : 'No visits recorded',
      }));

    return { count: inactive.length, sample };
  }

  private relativeDays(d: Date): string {
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(d).getTime()) / 86400000),
    );
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }
}
