import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberStreakService } from './member-streak.service';
import type {
  LeaderboardData,
  ChallengeListData,
  ChallengeItemData,
  ChallengeJoinResultData,
  BadgeListData,
} from '../contract';

/** Badge rules — evaluated against the member's REAL stats. */
const BADGE_RULES: {
  key: string;
  label: string;
  description: string;
  earned: (s: { checkins: number; streak: number; workouts: number }) => boolean;
}[] = [
  { key: 'first_checkin', label: 'First Step', description: 'Check in for the first time', earned: (s) => s.checkins >= 1 },
  { key: 'streak_3', label: 'On a Roll', description: 'Reach a 3-day streak', earned: (s) => s.streak >= 3 },
  { key: 'streak_7', label: 'Week Warrior', description: 'Reach a 7-day streak', earned: (s) => s.streak >= 7 },
  { key: 'streak_30', label: 'Unstoppable', description: 'Reach a 30-day streak', earned: (s) => s.streak >= 30 },
  { key: 'checkins_10', label: 'Regular', description: 'Check in 10 times', earned: (s) => s.checkins >= 10 },
  { key: 'checkins_50', label: 'Committed', description: 'Check in 50 times', earned: (s) => s.checkins >= 50 },
  { key: 'first_workout', label: 'Iron Started', description: 'Log your first workout', earned: (s) => s.workouts >= 1 },
];

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER COMMUNITY SERVICE (V2.5) — real data only
 * ────────────────────────────────────────────────────────────────
 *
 * Leaderboard + badges are COMPUTED from real check-ins / workout logs (nothing
 * fabricated). Challenges are real rows; progress is computed from the member's
 * activity in the window, so it can't drift. The leaderboard is the one place that
 * intentionally reads OTHER members in the gym (gym-scoped) — it exposes first
 * names + counts only, never PII.
 */
@Injectable()
export class MemberCommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streak: MemberStreakService,
  ) {}

  async leaderboard(
    member: CurrentMemberContext,
    periodDays = 30,
  ): Promise<LeaderboardData> {
    const days = Math.min(365, Math.max(1, periodDays || 30));
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const grouped = await this.prisma.checkIn.groupBy({
      by: ['member_id'],
      where: { checked_in_at: { gte: cutoff } },
      _count: { _all: true },
    });

    const ranked = grouped
      .map((g) => ({ memberId: g.member_id, value: g._count._all }))
      .sort((a, b) => b.value - a.value);

    const names = await this.prisma.member.findMany({
      where: { id: { in: ranked.map((r) => r.memberId) } },
      select: { id: true, full_name: true },
    });
    const firstName = new Map(
      names.map((n) => [n.id, (n.full_name ?? 'Member').trim().split(/\s+/)[0]]),
    );

    const entries = ranked.slice(0, 20).map((r, i) => ({
      rank: i + 1,
      name: firstName.get(r.memberId) ?? 'Member',
      value: r.value,
      isMe: r.memberId === member.memberId,
    }));

    const myIndex = ranked.findIndex((r) => r.memberId === member.memberId);
    return {
      metric: 'checkins',
      periodDays: days,
      entries,
      myRank: myIndex >= 0 ? myIndex + 1 : null,
      myValue: myIndex >= 0 ? ranked[myIndex].value : 0,
    };
  }

  async challenges(member: CurrentMemberContext): Promise<ChallengeListData> {
    const rows = await this.prisma.challenge.findMany({
      where: { is_active: true },
      orderBy: { ends_at: 'asc' },
      include: { participants: { select: { member_id: true } } },
    });

    const challenges = await Promise.all(
      rows.map(async (c): Promise<ChallengeItemData> => {
        const joined = c.participants.some((p) => p.member_id === member.memberId);
        const progress = joined ? await this.progressFor(member.memberId, c) : 0;
        return {
          id: c.id,
          title: c.title,
          description: c.description ?? null,
          metric: c.metric === 'workouts' ? 'workouts' : 'checkins',
          goal: c.goal,
          startsAt: c.starts_at.toISOString(),
          endsAt: c.ends_at.toISOString(),
          joined,
          progress,
          completed: joined && progress >= c.goal,
          participantCount: c.participants.length,
        };
      }),
    );
    return { challenges };
  }

  async join(
    member: CurrentMemberContext,
    challengeId: string,
  ): Promise<ChallengeJoinResultData> {
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId, is_active: true },
    });
    if (!challenge) throw MemberException.notFound('Challenge not found.');

    const existing = await this.prisma.challengeParticipant.findFirst({
      where: { challenge_id: challengeId, member_id: member.memberId },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.challengeParticipant.create({
        data: {
          gym_id: member.tenantId,
          challenge_id: challengeId,
          member_id: member.memberId,
        },
      });
    }
    const progress = await this.progressFor(member.memberId, challenge);
    return { joined: true, progress };
  }

  async badges(member: CurrentMemberContext): Promise<BadgeListData> {
    const [checkins, streak, workouts] = await Promise.all([
      this.prisma.checkIn.count({ where: { member_id: member.memberId } }),
      this.streak.getStreakDays(member.memberId),
      this.prisma.workoutLog.count({ where: { member_id: member.memberId } }),
    ]);
    const stats = { checkins, streak, workouts };

    const badges = BADGE_RULES.map((b) => ({
      key: b.key,
      label: b.label,
      description: b.description,
      earned: b.earned(stats),
    }));
    return { badges, earnedCount: badges.filter((b) => b.earned).length };
  }

  // ── helpers ────────────────────────────────────────────────────

  private async progressFor(
    memberId: string,
    challenge: { metric: string; starts_at: Date; ends_at: Date },
  ): Promise<number> {
    const start = challenge.starts_at;
    const now = new Date();
    const end = challenge.ends_at < now ? challenge.ends_at : now;
    if (challenge.metric === 'workouts') {
      return this.prisma.workoutLog.count({
        where: { member_id: memberId, logged_at: { gte: start, lte: end } },
      });
    }
    return this.prisma.checkIn.count({
      where: { member_id: memberId, checked_in_at: { gte: start, lte: end } },
    });
  }
}
