import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { decodePolyline, encodePolyline, trimPrivacyZone } from './polyline';
import { loadViewerScope, visibleActivityFilter } from './activity-visibility';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER FEED SERVICE — follows, feed, kudos, comments, blocks
 * ────────────────────────────────────────────────────────────────
 *
 * Entirely `public` / app_user scoped. No gym schema is touched and none of
 * these models carry gym_id, so nothing here can cross a tenant boundary.
 *
 * ONE VISIBILITY RULE. Every path that can return somebody else's activity —
 * the feed, a single activity, the comment thread — goes through
 * `visibleFilter`. A second copy of "who may see this" is how a leak gets
 * written: the feed gets fixed and the direct link does not.
 */
@Injectable()
export class MemberFeedService {
  private static readonly PAGE = 20;
  private static readonly COMMENT_MAX = 1000;

  constructor(private readonly pub: PublicPrismaService) {}

  /** Everyone this member has blocked, and everyone who has blocked them. */
  private async blockedIds(meId: string): Promise<string[]> {
    return (await loadViewerScope(this.pub, meId)).blocked;
  }

  private async followingIds(meId: string): Promise<string[]> {
    return (await loadViewerScope(this.pub, meId)).following;
  }

  /** @see visibleActivityFilter — the one definition, shared with clubs. */
  private visibleFilter(meId: string, following: string[], blocked: string[]) {
    return visibleActivityFilter(meId, { following, blocked });
  }

  /**
   * Strip anything the viewer is not entitled to.
   *
   * The owner sees their own track whole. Everyone else gets it trimmed by the
   * privacy zone and without the exact start coordinates — the pair of fields
   * that together give away a home address.
   */
  private forViewer(a: any, meId: string) {
    const mine = a.app_user_id === meId;
    let polyline = a.polyline as string | null;
    let startLatitude = a.start_latitude;
    let startLongitude = a.start_longitude;

    if (!mine && a.privacy_zone_m && a.privacy_zone_m > 0) {
      polyline = polyline
        ? encodePolyline(trimPrivacyZone(decodePolyline(polyline), a.privacy_zone_m))
        : null;
      startLatitude = null;
      startLongitude = null;
    }

    return {
      id: a.id,
      appUserId: a.app_user_id,
      athlete: a.app_user ? { id: a.app_user.id, name: a.app_user.full_name } : null,
      sportType: a.sport_type,
      title: a.title,
      startedAt: a.started_at.toISOString(),
      elapsedSeconds: a.elapsed_seconds,
      movingSeconds: a.moving_seconds,
      distanceM: a.distance_m == null ? null : Number(a.distance_m),
      elevationGainM: a.elevation_gain_m == null ? null : Number(a.elevation_gain_m),
      avgHeartRate: a.avg_heart_rate,
      polyline,
      startLatitude: startLatitude == null ? null : Number(startLatitude),
      startLongitude: startLongitude == null ? null : Number(startLongitude),
      visibility: a.visibility,
      kudosCount: a.kudos_count,
      commentCount: a.comment_count,
      mine,
      kudosedByMe: (a.kudos ?? []).length > 0,
    };
  }

  // ── Follows ─────────────────────────────────────────────────────
  async follow(member: CurrentMemberContext, appUserId: string) {
    if (appUserId === member.appUserId) {
      throw MemberException.badRequest('You cannot follow yourself.');
    }
    const target = await this.pub.appUser.findUnique({
      where: { id: appUserId },
      select: { id: true },
    });
    if (!target) throw MemberException.notFound('Person not found.');

    // A block in EITHER direction stops a follow. Otherwise blocking someone
    // would not stop them re-appearing the moment they pressed Follow again.
    const blocked = await this.blockedIds(member.appUserId);
    if (blocked.includes(appUserId)) throw MemberException.notFound('Person not found.');

    await this.pub.follow.upsert({
      where: {
        follower_id_followee_id: { follower_id: member.appUserId, followee_id: appUserId },
      },
      create: { follower_id: member.appUserId, followee_id: appUserId },
      update: {},
    });
    return { following: true };
  }

  async unfollow(member: CurrentMemberContext, appUserId: string) {
    await this.pub.follow.deleteMany({
      where: { follower_id: member.appUserId, followee_id: appUserId },
    });
    return { following: false };
  }

  async following(member: CurrentMemberContext) {
    const rows = await this.pub.follow.findMany({
      where: { follower_id: member.appUserId },
      select: { followee: { select: { id: true, full_name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return { people: rows.map((r) => ({ id: r.followee.id, name: r.followee.full_name })) };
  }

  async followers(member: CurrentMemberContext) {
    const rows = await this.pub.follow.findMany({
      where: { followee_id: member.appUserId },
      select: { follower: { select: { id: true, full_name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return { people: rows.map((r) => ({ id: r.follower.id, name: r.follower.full_name })) };
  }

  // ── Blocks ──────────────────────────────────────────────────────
  async block(member: CurrentMemberContext, appUserId: string) {
    if (appUserId === member.appUserId) {
      throw MemberException.badRequest('You cannot block yourself.');
    }
    await this.pub.block.upsert({
      where: {
        blocker_id_blocked_id: { blocker_id: member.appUserId, blocked_id: appUserId },
      },
      create: { blocker_id: member.appUserId, blocked_id: appUserId },
      update: {},
    });
    // Blocking severs the follow both ways. Leaving it would keep their
    // activities queued for a feed they can no longer see, and vice versa.
    await this.pub.follow.deleteMany({
      where: {
        OR: [
          { follower_id: member.appUserId, followee_id: appUserId },
          { follower_id: appUserId, followee_id: member.appUserId },
        ],
      },
    });
    return { blocked: true };
  }

  async unblock(member: CurrentMemberContext, appUserId: string) {
    await this.pub.block.deleteMany({
      where: { blocker_id: member.appUserId, blocked_id: appUserId },
    });
    return { blocked: false };
  }

  // ── Feed ────────────────────────────────────────────────────────
  async feed(member: CurrentMemberContext, before?: string, limit?: number) {
    const take = Math.min(Math.max(limit ?? MemberFeedService.PAGE, 1), 50);
    const [following, blocked] = await Promise.all([
      this.followingIds(member.appUserId),
      this.blockedIds(member.appUserId),
    ]);

    const rows = await this.pub.appUserActivity.findMany({
      where: {
        AND: [
          this.visibleFilter(member.appUserId, following, blocked),
          ...(before ? [{ started_at: { lt: new Date(before) } }] : []),
        ],
      },
      orderBy: { started_at: 'desc' },
      take: take + 1,
      include: {
        app_user: { select: { id: true, full_name: true } },
        kudos: { where: { app_user_id: member.appUserId }, select: { id: true } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      activities: page.map((a) => this.forViewer(a, member.appUserId)),
      nextBefore: hasMore ? page[page.length - 1].started_at.toISOString() : null,
    };
  }

  /** One activity, by the same rule the feed uses. */
  async view(member: CurrentMemberContext, activityId: string) {
    const [following, blocked] = await Promise.all([
      this.followingIds(member.appUserId),
      this.blockedIds(member.appUserId),
    ]);
    const a = await this.pub.appUserActivity.findFirst({
      where: {
        AND: [{ id: activityId }, this.visibleFilter(member.appUserId, following, blocked)],
      },
      include: {
        app_user: { select: { id: true, full_name: true } },
        kudos: { where: { app_user_id: member.appUserId }, select: { id: true } },
      },
    });
    // Hidden and non-existent are the same answer: a distinguishable 403 would
    // confirm that a private activity exists.
    if (!a) throw MemberException.notFound('Activity not found.');
    return this.forViewer(a, member.appUserId);
  }

  /** Throws unless the activity is visible to this member. */
  private async assertVisible(member: CurrentMemberContext, activityId: string) {
    await this.view(member, activityId);
  }

  // ── Kudos ───────────────────────────────────────────────────────
  async giveKudos(member: CurrentMemberContext, activityId: string) {
    await this.assertVisible(member, activityId);
    const existing = await this.pub.activityKudos.findFirst({
      where: { activity_id: activityId, app_user_id: member.appUserId },
      select: { id: true },
    });
    // Idempotent: a double tap is one kudos, and the counter only moves when
    // the row is actually created.
    if (existing) return { kudosed: true };

    await this.pub.activityKudos.create({
      data: { activity_id: activityId, app_user_id: member.appUserId },
    });
    await this.pub.appUserActivity.update({
      where: { id: activityId },
      data: { kudos_count: { increment: 1 } },
    });
    return { kudosed: true };
  }

  async removeKudos(member: CurrentMemberContext, activityId: string) {
    const res = await this.pub.activityKudos.deleteMany({
      where: { activity_id: activityId, app_user_id: member.appUserId },
    });
    if (res.count > 0) {
      await this.pub.appUserActivity.update({
        where: { id: activityId },
        data: { kudos_count: { decrement: 1 } },
      });
    }
    return { kudosed: false };
  }

  // ── Comments ────────────────────────────────────────────────────
  async comments(member: CurrentMemberContext, activityId: string) {
    await this.assertVisible(member, activityId);
    const blocked = await this.blockedIds(member.appUserId);
    const rows = await this.pub.activityComment.findMany({
      where: {
        activity_id: activityId,
        deleted_at: null,
        // A blocked person's comments disappear from the thread too, or the
        // block only half works.
        app_user_id: { notIn: blocked },
      },
      orderBy: { created_at: 'asc' },
      include: { app_user: { select: { id: true, full_name: true } } },
    });
    return {
      comments: rows.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.created_at.toISOString(),
        author: { id: c.app_user.id, name: c.app_user.full_name },
        mine: c.app_user_id === member.appUserId,
      })),
    };
  }

  async addComment(member: CurrentMemberContext, activityId: string, body: string) {
    await this.assertVisible(member, activityId);
    const text = (body ?? '').trim();
    if (!text) throw MemberException.badRequest('Write something first.');
    if (text.length > MemberFeedService.COMMENT_MAX) {
      throw MemberException.badRequest(
        `Comments are limited to ${MemberFeedService.COMMENT_MAX} characters.`,
      );
    }

    const row = await this.pub.activityComment.create({
      data: { activity_id: activityId, app_user_id: member.appUserId, body: text },
      include: { app_user: { select: { id: true, full_name: true } } },
    });
    await this.pub.appUserActivity.update({
      where: { id: activityId },
      data: { comment_count: { increment: 1 } },
    });
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at.toISOString(),
      author: { id: row.app_user.id, name: row.app_user.full_name },
      mine: true,
    };
  }

  /**
   * Remove a comment.
   *
   * Its author may delete it, and so may the OWNER of the activity — someone
   * must be able to clear abuse off their own post without waiting for us.
   */
  async deleteComment(member: CurrentMemberContext, commentId: string) {
    const c = await this.pub.activityComment.findUnique({
      where: { id: commentId },
      include: { activity: { select: { id: true, app_user_id: true } } },
    });
    if (!c || c.deleted_at) throw MemberException.notFound('Comment not found.');
    if (c.app_user_id !== member.appUserId && c.activity.app_user_id !== member.appUserId) {
      throw MemberException.notFound('Comment not found.');
    }

    await this.pub.activityComment.update({
      where: { id: commentId },
      data: { deleted_at: new Date() },
    });
    await this.pub.appUserActivity.update({
      where: { id: c.activity.id },
      data: { comment_count: { decrement: 1 } },
    });
    return { deleted: true };
  }
}
