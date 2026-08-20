import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { loadViewerScope } from './activity-visibility';
import { isSportKey } from './sport-types';
import type { GroupChallengeDto } from './dto';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER CHALLENGE SERVICE — member-made contests
 * ────────────────────────────────────────────────────────────────
 *
 * Distinct from the gym-run `challenges`: these are created by members, span
 * gyms, and only invited people take part. All `public` / app_user scoped.
 *
 * PROGRESS IS COMPUTED, NEVER STORED. A stored total drifts the instant an
 * activity is edited or deleted, and nobody notices until the leaderboard has
 * been wrong for a week. It is summed from activities on read.
 *
 * JOINING IS THE CONSENT. A leaderboard publishes each participant's SUM for
 * the chosen metric — not their activities. An activity marked only_me still
 * appears nowhere; it just counts toward a number the member opted in to.
 */
@Injectable()
export class MemberChallengeService {
  private static readonly METRICS = new Set([
    'distance_m', 'elapsed_seconds', 'activity_count', 'elevation_m',
  ]);

  constructor(private readonly pub: PublicPrismaService) {}

  private async isIn(challengeId: string, meId: string) {
    return this.pub.groupChallengeParticipant.findFirst({
      where: { challenge_id: challengeId, app_user_id: meId },
      select: { id: true },
    });
  }

  private toChallenge(c: any, joined: boolean, participantCount: number) {
    return {
      id: c.id,
      title: c.title,
      metric: c.metric,
      sportType: c.sport_type,
      target: c.target == null ? null : Number(c.target),
      startsOn: c.starts_on.toISOString().slice(0, 10),
      endsOn: c.ends_on.toISOString().slice(0, 10),
      ownerId: c.owner_id,
      joined,
      participantCount,
    };
  }

  async mine(member: CurrentMemberContext) {
    const rows = await this.pub.groupChallengeParticipant.findMany({
      where: { app_user_id: member.appUserId },
      include: { challenge: { include: { _count: { select: { participants: true } } } } },
      orderBy: { joined_at: 'desc' },
    });
    return {
      challenges: rows.map((r) =>
        this.toChallenge(r.challenge, true, r.challenge._count.participants),
      ),
    };
  }

  async create(member: CurrentMemberContext, dto: GroupChallengeDto) {
    if (!MemberChallengeService.METRICS.has(dto.metric)) {
      throw MemberException.badRequest(`Unknown metric "${dto.metric}".`);
    }
    if (dto.sportType && !isSportKey(dto.sportType)) {
      throw MemberException.badRequest(`Unknown sport type "${dto.sportType}".`);
    }
    const starts = new Date(dto.startsOn);
    const ends = new Date(dto.endsOn);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      throw MemberException.badRequest('Dates are not valid.');
    }
    if (ends < starts) {
      throw MemberException.badRequest('A challenge cannot end before it starts.');
    }

    const c = await this.pub.groupChallenge.create({
      data: {
        owner_id: member.appUserId,
        title: dto.title.trim(),
        metric: dto.metric,
        sport_type: dto.sportType ?? null,
        target: dto.target ?? null,
        starts_on: starts,
        ends_on: ends,
      },
    });
    // The creator is in it from the first moment; a challenge whose owner is
    // not competing reads as a mistake.
    await this.pub.groupChallengeParticipant.create({
      data: { challenge_id: c.id, app_user_id: member.appUserId },
    });
    return this.toChallenge(c, true, 1);
  }

  async join(member: CurrentMemberContext, challengeId: string) {
    const c = await this.pub.groupChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, ends_on: true },
    });
    if (!c) throw MemberException.notFound('Challenge not found.');
    // Joining after it ended would put someone on a leaderboard they could
    // never have competed in.
    if (c.ends_on < new Date(new Date().toISOString().slice(0, 10))) {
      throw MemberException.badRequest('That challenge has already finished.');
    }

    const existing = await this.isIn(challengeId, member.appUserId);
    if (existing) return { joined: true };

    await this.pub.groupChallengeParticipant.create({
      data: { challenge_id: challengeId, app_user_id: member.appUserId },
    });
    return { joined: true };
  }

  async leave(member: CurrentMemberContext, challengeId: string) {
    await this.pub.groupChallengeParticipant.deleteMany({
      where: { challenge_id: challengeId, app_user_id: member.appUserId },
    });
    return { joined: false };
  }

  /**
   * The challenge and its leaderboard.
   *
   * One aggregate over the participants' activities inside the window. Blocked
   * people are dropped from the board — not from the challenge, which is not
   * ours to alter, but a block should mean you stop seeing them.
   */
  async get(member: CurrentMemberContext, challengeId: string) {
    const c = await this.pub.groupChallenge.findUnique({
      where: { id: challengeId },
      include: { participants: { include: { app_user: { select: { id: true, full_name: true } } } } },
    });
    if (!c) throw MemberException.notFound('Challenge not found.');

    const joined = c.participants.some((p) => p.app_user_id === member.appUserId);
    if (!joined) {
      // Invite-only: the board is for the people in it.
      throw MemberException.notFound('Challenge not found.');
    }

    const scope = await loadViewerScope(this.pub, member.appUserId);
    const ids = c.participants.map((p) => p.app_user_id);

    // Dates are inclusive of the final day, so the window runs to the start of
    // the day AFTER ends_on.
    const from = c.starts_on;
    const to = new Date(c.ends_on.getTime() + 86_400_000);

    const rows = await this.pub.appUserActivity.groupBy({
      by: ['app_user_id'],
      where: {
        app_user_id: { in: ids },
        started_at: { gte: from, lt: to },
        ...(c.sport_type ? { sport_type: c.sport_type } : {}),
      },
      _sum: { distance_m: true, elapsed_seconds: true, elevation_gain_m: true },
      _count: { _all: true },
    });

    const valueOf = (r: (typeof rows)[number] | undefined) => {
      if (!r) return 0;
      switch (c.metric) {
        case 'elapsed_seconds': return r._sum.elapsed_seconds ?? 0;
        case 'activity_count': return r._count._all ?? 0;
        case 'elevation_m': return Number(r._sum.elevation_gain_m ?? 0);
        default: return Number(r._sum.distance_m ?? 0);
      }
    };
    const byUser = new Map(rows.map((r) => [r.app_user_id, r]));

    const board = c.participants
      .filter((p) => !scope.blocked.includes(p.app_user_id))
      .map((p) => ({
        id: p.app_user.id,
        name: p.app_user.full_name,
        value: valueOf(byUser.get(p.app_user_id)),
        mine: p.app_user_id === member.appUserId,
      }))
      .sort((a, b) => b.value - a.value)
      .map((row, i) => ({ ...row, rank: i + 1 }));

    return {
      ...this.toChallenge(c, true, c.participants.length),
      leaderboard: board,
    };
  }

  /** Add someone to a challenge. Owner only — an open invite is a spam vector. */
  async invite(member: CurrentMemberContext, challengeId: string, appUserId: string) {
    const c = await this.pub.groupChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, owner_id: true },
    });
    if (!c) throw MemberException.notFound('Challenge not found.');
    if (c.owner_id !== member.appUserId) {
      throw MemberException.badRequest('Only the person who made it can invite others.');
    }

    const scope = await loadViewerScope(this.pub, member.appUserId);
    if (scope.blocked.includes(appUserId)) {
      throw MemberException.notFound('Person not found.');
    }

    const existing = await this.isIn(challengeId, appUserId);
    if (existing) return { invited: true };
    await this.pub.groupChallengeParticipant.create({
      data: { challenge_id: challengeId, app_user_id: appUserId },
    });
    return { invited: true };
  }
}
