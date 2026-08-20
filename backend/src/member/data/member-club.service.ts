import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { loadViewerScope, visibleActivityFilter } from './activity-visibility';
import { isSportKey } from './sport-types';
import type { ClubCreateDto, ClubEventDto } from './dto';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER CLUB SERVICE — clubs and their events
 * ────────────────────────────────────────────────────────────────
 *
 * A club is a group of PEOPLE, not a gym. It lives in `public`, carries no
 * gym_id and never reaches into a studio schema, so it adds no cross-tenant
 * surface — same as follows and activities.
 *
 * THE CLUB FEED HAS NO RULES OF ITS OWN. It is "activities by people in this
 * club" passed through `visibleActivityFilter`, the same function the main
 * feed uses. Joining a club must never become a way to see something its owner
 * chose not to share.
 */
@Injectable()
export class MemberClubService {
  private static readonly PAGE = 20;

  constructor(private readonly pub: PublicPrismaService) {}

  private async membership(clubId: string, meId: string) {
    return this.pub.clubMember.findFirst({
      where: { club_id: clubId, app_user_id: meId },
      select: { role: true },
    });
  }

  private toClub(c: any, myRole: string | null) {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      sportType: c.sport_type,
      city: c.city,
      visibility: c.visibility,
      memberCount: c.member_count,
      myRole,
      joined: myRole !== null,
    };
  }

  // ── Discovery and membership ────────────────────────────────────
  /** Public clubs only. A private club is unlisted by definition. */
  async discover(member: CurrentMemberContext, sport?: string) {
    const rows = await this.pub.club.findMany({
      where: {
        visibility: 'public',
        ...(sport && isSportKey(sport) ? { sport_type: sport } : {}),
      },
      orderBy: [{ member_count: 'desc' }, { created_at: 'desc' }],
      take: 50,
    });
    const mine = await this.pub.clubMember.findMany({
      where: { app_user_id: member.appUserId, club_id: { in: rows.map((r) => r.id) } },
      select: { club_id: true, role: true },
    });
    const roles = new Map(mine.map((m) => [m.club_id, m.role]));
    return { clubs: rows.map((c) => this.toClub(c, roles.get(c.id) ?? null)) };
  }

  async myClubs(member: CurrentMemberContext) {
    const rows = await this.pub.clubMember.findMany({
      where: { app_user_id: member.appUserId },
      include: { club: true },
      orderBy: { joined_at: 'desc' },
    });
    return { clubs: rows.map((r) => this.toClub(r.club, r.role)) };
  }

  /**
   * One club.
   *
   * A private club is readable by id — that IS the invite link. It stays out of
   * discovery, which is the whole of what "private" promises here.
   */
  async get(member: CurrentMemberContext, clubId: string) {
    const c = await this.pub.club.findUnique({ where: { id: clubId } });
    if (!c) throw MemberException.notFound('Club not found.');
    const mine = await this.membership(clubId, member.appUserId);
    return this.toClub(c, mine?.role ?? null);
  }

  async create(member: CurrentMemberContext, dto: ClubCreateDto) {
    if (dto.sportType && !isSportKey(dto.sportType)) {
      throw MemberException.badRequest(`Unknown sport type "${dto.sportType}".`);
    }
    const club = await this.pub.club.create({
      data: {
        owner_id: member.appUserId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        sport_type: dto.sportType ?? null,
        city: dto.city ?? null,
        visibility: dto.visibility ?? 'public',
        // The creator is a member from the first moment; a club with an owner
        // who is not in it would report 0 members and an empty feed.
        member_count: 1,
      },
    });
    await this.pub.clubMember.create({
      data: { club_id: club.id, app_user_id: member.appUserId, role: 'owner' },
    });
    return this.toClub(club, 'owner');
  }

  async join(member: CurrentMemberContext, clubId: string) {
    const club = await this.pub.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) throw MemberException.notFound('Club not found.');

    const existing = await this.membership(clubId, member.appUserId);
    // Idempotent: joining twice is joining once, and the counter only moves
    // when a row is actually created.
    if (existing) return { joined: true, role: existing.role };

    await this.pub.clubMember.create({
      data: { club_id: clubId, app_user_id: member.appUserId, role: 'member' },
    });
    await this.pub.club.update({
      where: { id: clubId },
      data: { member_count: { increment: 1 } },
    });
    return { joined: true, role: 'member' };
  }

  async leave(member: CurrentMemberContext, clubId: string) {
    const mine = await this.membership(clubId, member.appUserId);
    if (!mine) return { joined: false };
    // The owner leaving would orphan the club — events with no one able to
    // manage them, and a members list nobody can moderate.
    if (mine.role === 'owner') {
      throw MemberException.badRequest(
        'Hand the club to someone else before leaving it.',
      );
    }
    await this.pub.clubMember.deleteMany({
      where: { club_id: clubId, app_user_id: member.appUserId },
    });
    await this.pub.club.update({
      where: { id: clubId },
      data: { member_count: { decrement: 1 } },
    });
    return { joined: false };
  }

  async members(member: CurrentMemberContext, clubId: string) {
    const mine = await this.membership(clubId, member.appUserId);
    if (!mine) throw MemberException.notFound('Club not found.');
    const scope = await loadViewerScope(this.pub, member.appUserId);
    const rows = await this.pub.clubMember.findMany({
      where: {
        club_id: clubId,
        // Someone blocked stays out of the list too, or a block only half works.
        app_user_id: { notIn: scope.blocked },
      },
      include: { app_user: { select: { id: true, full_name: true } } },
      orderBy: { joined_at: 'asc' },
    });
    return {
      members: rows.map((r) => ({
        id: r.app_user.id,
        name: r.app_user.full_name,
        role: r.role,
      })),
    };
  }

  // ── Club feed ───────────────────────────────────────────────────
  async feed(member: CurrentMemberContext, clubId: string, before?: string, limit?: number) {
    const mine = await this.membership(clubId, member.appUserId);
    if (!mine) throw MemberException.notFound('Club not found.');

    const take = Math.min(Math.max(limit ?? MemberClubService.PAGE, 1), 50);
    const memberIds = (
      await this.pub.clubMember.findMany({
        where: { club_id: clubId },
        select: { app_user_id: true },
      })
    ).map((m) => m.app_user_id);

    const scope = await loadViewerScope(this.pub, member.appUserId);
    const rows = await this.pub.appUserActivity.findMany({
      where: {
        AND: [
          { app_user_id: { in: memberIds } },
          // The SAME rule as the main feed. Membership narrows WHO appears; it
          // never widens WHAT is visible.
          visibleActivityFilter(member.appUserId, scope),
          ...(before ? [{ started_at: { lt: new Date(before) } }] : []),
        ],
      },
      orderBy: { started_at: 'desc' },
      take: take + 1,
      include: { app_user: { select: { id: true, full_name: true } } },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      activities: page.map((a) => ({
        id: a.id,
        athlete: { id: a.app_user.id, name: a.app_user.full_name },
        sportType: a.sport_type,
        title: a.title,
        startedAt: a.started_at.toISOString(),
        elapsedSeconds: a.elapsed_seconds,
        distanceM: a.distance_m == null ? null : Number(a.distance_m),
        kudosCount: a.kudos_count,
        mine: a.app_user_id === member.appUserId,
      })),
      nextBefore: hasMore ? page[page.length - 1].started_at.toISOString() : null,
    };
  }

  // ── Events ──────────────────────────────────────────────────────
  async events(member: CurrentMemberContext, clubId: string) {
    const mine = await this.membership(clubId, member.appUserId);
    if (!mine) throw MemberException.notFound('Club not found.');

    const rows = await this.pub.clubEvent.findMany({
      // Past events are history nobody can attend; the screen is about what to
      // turn up to.
      where: { club_id: clubId, starts_at: { gte: new Date() } },
      orderBy: { starts_at: 'asc' },
      include: {
        attendees: { where: { app_user_id: member.appUserId }, select: { status: true } },
      },
    });
    return {
      events: rows.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startsAt: e.starts_at.toISOString(),
        locationName: e.location_name,
        attendeeCount: e.attendee_count,
        myStatus: e.attendees[0]?.status ?? null,
      })),
    };
  }

  async createEvent(member: CurrentMemberContext, clubId: string, dto: ClubEventDto) {
    const mine = await this.membership(clubId, member.appUserId);
    if (!mine) throw MemberException.notFound('Club not found.');
    // Anyone could post an event otherwise, and a club's schedule is the thing
    // its members trust.
    if (mine.role === 'member') {
      throw MemberException.badRequest('Only club admins can add events.');
    }

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw MemberException.badRequest('startsAt is not a valid date.');
    }
    if (startsAt.getTime() < Date.now()) {
      throw MemberException.badRequest('An event cannot start in the past.');
    }

    const e = await this.pub.clubEvent.create({
      data: {
        club_id: clubId,
        created_by: member.appUserId,
        title: dto.title.trim(),
        description: dto.description ?? null,
        starts_at: startsAt,
        location_name: dto.locationName ?? null,
      },
    });
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      startsAt: e.starts_at.toISOString(),
      locationName: e.location_name,
      attendeeCount: 0,
      myStatus: null,
    };
  }

  async rsvp(member: CurrentMemberContext, eventId: string, status: 'going' | 'interested' | null) {
    const e = await this.pub.clubEvent.findUnique({
      where: { id: eventId },
      select: { id: true, club_id: true },
    });
    if (!e) throw MemberException.notFound('Event not found.');
    const mine = await this.membership(e.club_id, member.appUserId);
    if (!mine) throw MemberException.notFound('Event not found.');

    const existing = await this.pub.eventAttendee.findFirst({
      where: { event_id: eventId, app_user_id: member.appUserId },
      select: { id: true, status: true },
    });

    // The counter tracks 'going' only: "12 going" is a number people plan
    // around, and padding it with maybes makes it useless.
    const was = existing?.status === 'going' ? 1 : 0;
    const now = status === 'going' ? 1 : 0;

    if (status === null) {
      if (existing) await this.pub.eventAttendee.delete({ where: { id: existing.id } });
    } else if (existing) {
      await this.pub.eventAttendee.update({ where: { id: existing.id }, data: { status } });
    } else {
      await this.pub.eventAttendee.create({
        data: { event_id: eventId, app_user_id: member.appUserId, status },
      });
    }

    if (now !== was) {
      await this.pub.clubEvent.update({
        where: { id: eventId },
        data: { attendee_count: { increment: now - was } },
      });
    }
    return { status };
  }
}
