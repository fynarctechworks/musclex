import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { FriendPublisherService } from './friend-publisher.service';
import { MemberRoutineService } from './member-routine.service';

/**
 * ────────────────────────────────────────────────────────────────
 * FRIENDS
 * ────────────────────────────────────────────────────────────────
 *
 * Reads NOTHING from any gym schema. Everything a friend can see was published
 * into `public` by its owner, gated on their own sharing flags — see
 * FriendPublisherService. That is what makes a cross-gym feature safe in a
 * system where a cross-tenant read is the worst thing that can happen.
 *
 * Identity is the app_user, not the member: one person can belong to several
 * gyms, or none, and a friendship should survive them changing gym. Every
 * member session already carries `appUserId`, so nothing extra is needed.
 */
@Injectable()
export class MemberFriendService {
  constructor(
    private readonly pub: PublicPrismaService,
    private readonly publisher: FriendPublisherService,
    private readonly routines: MemberRoutineService,
  ) {}

  /** Digits only, so 09876 543210 and +91 9876543210 find the same person. */
  private digits(phone: string): string {
    return (phone ?? '').replace(/\D/g, '');
  }

  private me(member: CurrentMemberContext): string {
    if (!member.appUserId) throw MemberException.badRequest('No account for this session.');
    return member.appUserId;
  }

  /**
   * Find someone to add, by phone number ONLY.
   *
   * Deliberately not a name search. Over a national user base, name search is a
   * way to locate strangers; a phone number is something the other person
   * already chose to give you. Returns the barest identity — no gym, no stats,
   * nothing that would leak before a friendship exists.
   */
  async search(member: CurrentMemberContext, phone: string) {
    const meId = this.me(member);
    const wanted = this.digits(phone);
    if (wanted.length < 6) throw MemberException.badRequest('Enter a full phone number.');

    const rows = await this.pub.$queryRawUnsafe<{ id: string; full_name: string | null }[]>(
      `SELECT id, full_name FROM public.app_users
        WHERE regexp_replace(phone, '\\D', '', 'g') LIKE '%' || $1
        LIMIT 5`,
      wanted,
    );

    const found = rows.filter((r) => r.id !== meId);
    if (found.length === 0) return { results: [] };

    // Report any relationship that already exists so the client shows "Pending"
    // rather than offering an Add that will be refused.
    const existing = await this.pub.friendship.findMany({
      where: {
        OR: found.flatMap((f) => [
          { requester_id: meId, addressee_id: f.id },
          { requester_id: f.id, addressee_id: meId },
        ]),
      },
      select: { requester_id: true, addressee_id: true, status: true },
    });

    return {
      results: found.map((f) => {
        const rel = existing.find((e) => e.requester_id === f.id || e.addressee_id === f.id);
        return {
          appUserId: f.id,
          name: f.full_name ?? 'MuscleX member',
          status: rel?.status ?? null,
        };
      }),
    };
  }

  /** Send a request. Idempotent: asking twice does not create a second row. */
  async request(member: CurrentMemberContext, toAppUserId: string) {
    const meId = this.me(member);
    if (toAppUserId === meId) throw MemberException.badRequest('You cannot add yourself.');

    const target = await this.pub.appUser.findUnique({
      where: { id: toAppUserId },
      select: { id: true },
    });
    if (!target) throw MemberException.notFound('No such member.');

    const existing = await this.findPair(meId, toAppUserId);
    if (existing) {
      if (existing.status === 'accepted') return { status: 'accepted' as const };
      // They asked first — treat this as accepting rather than opening a
      // second request nobody would answer.
      if (existing.status === 'pending' && existing.addressee_id === meId) {
        return this.respond(member, existing.id, true);
      }
      // A blocked pair stays blocked; re-requesting must not clear it.
      return { status: existing.status as 'pending' | 'blocked' };
    }

    await this.pub.friendship.create({
      data: { requester_id: meId, addressee_id: toAppUserId },
    });
    return { status: 'pending' as const };
  }

  /** Accept or refuse. Only the ADDRESSEE may answer. */
  async respond(member: CurrentMemberContext, friendshipId: string, accept: boolean) {
    const meId = this.me(member);
    const row = await this.pub.friendship.findUnique({ where: { id: friendshipId } });
    if (!row || row.addressee_id !== meId) {
      // Same message either way: whether a given id exists is not something a
      // stranger should be able to probe.
      throw MemberException.notFound('Request not found.');
    }
    const status = accept ? 'accepted' : 'blocked';
    await this.pub.friendship.update({
      where: { id: friendshipId },
      data: { status, responded_at: new Date() },
    });
    return { status: status as 'accepted' | 'blocked' };
  }

  /**
   * Remove a friend.
   *
   * Deletes the RELATIONSHIP, not their data. Access is a join against this
   * table, so dropping the row revokes everything immediately; deleting what
   * they published would also erase kudos other people gave, rewriting history
   * that was legitimately seen.
   */
  async remove(member: CurrentMemberContext, friendAppUserId: string) {
    const meId = this.me(member);
    const { count } = await this.pub.friendship.deleteMany({
      where: {
        OR: [
          { requester_id: meId, addressee_id: friendAppUserId },
          { requester_id: friendAppUserId, addressee_id: meId },
        ],
      },
    });
    if (count === 0) throw MemberException.notFound('Not in your friends.');
    return { removed: true };
  }

  /** Accepted friends, plus requests waiting on ME. */
  async list(member: CurrentMemberContext) {
    const meId = this.me(member);
    const rows = await this.pub.friendship.findMany({
      where: { OR: [{ requester_id: meId }, { addressee_id: meId }] },
      include: {
        requester: { select: { id: true, full_name: true } },
        addressee: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const friends = [];
    const incoming = [];
    for (const r of rows) {
      const other = r.requester_id === meId ? r.addressee : r.requester;
      const entry = {
        appUserId: other.id,
        name: other.full_name ?? 'MuscleX member',
      };
      if (r.status === 'accepted') friends.push(entry);
      else if (r.status === 'pending' && r.addressee_id === meId) {
        incoming.push({ ...entry, requestId: r.id });
      }
    }
    return { friends, incoming };
  }

  /** app_user ids of accepted friends — the gate every read below passes through. */
  private async friendIds(meId: string): Promise<string[]> {
    const rows = await this.pub.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requester_id: meId }, { addressee_id: meId }],
      },
      select: { requester_id: true, addressee_id: true },
    });
    return rows.map((r) => (r.requester_id === meId ? r.addressee_id : r.requester_id));
  }

  private async assertFriend(meId: string, otherId: string): Promise<void> {
    const ids = await this.friendIds(meId);
    if (!ids.includes(otherId)) throw MemberException.notFound('Not in your friends.');
  }

  /**
   * Friends' recent sessions, newest first.
   *
   * Only rows their owner published, and only from people who accepted — two
   * independent gates, so neither alone can leak a session.
   */
  async feed(member: CurrentMemberContext, limit = 30) {
    const meId = this.me(member);
    const ids = await this.friendIds(meId);
    if (ids.length === 0) return { sessions: [] };

    const rows = await this.pub.appUserSession.findMany({
      where: { app_user_id: { in: ids } },
      orderBy: { performed_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: { app_user: { select: { id: true, full_name: true } } },
    });

    // One query for my kudos across the page, rather than one per row.
    const mine = await this.pub.sessionKudos.findMany({
      where: { app_user_id: meId, session_id: { in: rows.map((r) => r.id) } },
      select: { session_id: true },
    });
    const kudosed = new Set(mine.map((k) => k.session_id));

    return {
      sessions: rows.map((r) => ({
        id: r.id,
        appUserId: r.app_user_id,
        name: r.app_user.full_name ?? 'MuscleX member',
        performedAt: r.performed_at.toISOString(),
        title: r.title,
        exerciseCount: r.exercise_count,
        setCount: r.set_count,
        totalVolumeKg: r.total_volume_kg === null ? null : Number(r.total_volume_kg),
        durationSeconds: r.duration_seconds,
        exerciseNames: r.exercise_names as string[],
        kudosCount: r.kudos_count,
        kudosedByMe: kudosed.has(r.id),
      })),
    };
  }

  /** Toggle kudos. Returns the resulting state so the client need not guess. */
  async toggleKudos(member: CurrentMemberContext, sessionId: string) {
    const meId = this.me(member);
    const session = await this.pub.appUserSession.findUnique({
      where: { id: sessionId },
      select: { id: true, app_user_id: true },
    });
    if (!session) throw MemberException.notFound('Session not found.');
    await this.assertFriend(meId, session.app_user_id);

    const existing = await this.pub.sessionKudos.findUnique({
      where: { session_id_app_user_id: { session_id: sessionId, app_user_id: meId } },
    });

    if (existing) {
      await this.pub.sessionKudos.delete({ where: { id: existing.id } });
      const s = await this.pub.appUserSession.update({
        where: { id: sessionId },
        data: { kudos_count: { decrement: 1 } },
        select: { kudos_count: true },
      });
      return { kudosed: false, kudosCount: s.kudos_count };
    }

    await this.pub.sessionKudos.create({
      data: { session_id: sessionId, app_user_id: meId },
    });
    const s = await this.pub.appUserSession.update({
      where: { id: sessionId },
      data: { kudos_count: { increment: 1 } },
      select: { kudos_count: true },
    });
    return { kudosed: true, kudosCount: s.kudos_count };
  }

  /**
   * Compare best lifts with one friend.
   *
   * Matched on exercise NAME because ids are gym-scoped — the same lift has a
   * different id at each gym, so an id comparison would report that two people
   * have nothing in common. Only lifts BOTH have recorded are returned: a list
   * of exercises only one of you does is not a comparison.
   */
  async comparePrs(member: CurrentMemberContext, friendAppUserId: string) {
    const meId = this.me(member);
    await this.assertFriend(meId, friendAppUserId);

    const [mine, theirs, them] = await Promise.all([
      this.pub.appUserPr.findMany({ where: { app_user_id: meId } }),
      this.pub.appUserPr.findMany({ where: { app_user_id: friendAppUserId } }),
      this.pub.appUser.findUnique({
        where: { id: friendAppUserId },
        select: { full_name: true, share_prs: true },
      }),
    ]);

    if (!them?.share_prs) {
      // Distinguished from "no lifts in common" so the client can say why.
      return { sharing: false as const, name: them?.full_name ?? 'MuscleX member', lifts: [] };
    }

    const byName = new Map(theirs.map((p) => [p.exercise_name, p]));
    const lifts = mine
      .filter((p) => byName.has(p.exercise_name))
      .map((p) => {
        const t = byName.get(p.exercise_name)!;
        return {
          exercise: p.exercise_name,
          mine: { weightKg: Number(p.weight_kg), reps: p.reps, achievedAt: p.achieved_at.toISOString() },
          theirs: { weightKg: Number(t.weight_kg), reps: t.reps, achievedAt: t.achieved_at.toISOString() },
        };
      })
      .sort((a, b) => b.mine.weightKg - a.mine.weightKg);

    return { sharing: true as const, name: them.full_name ?? 'MuscleX member', lifts };
  }

  /** The member's own sharing switches. */
  async prefs(member: CurrentMemberContext) {
    const meId = this.me(member);
    const row = await this.pub.appUser.findUnique({
      where: { id: meId },
      select: { share_sessions: true, share_prs: true, share_streak: true },
    });
    return {
      shareSessions: !!row?.share_sessions,
      sharePrs: !!row?.share_prs,
      shareStreak: !!row?.share_streak,
    };
  }

  /**
   * Change the switches.
   *
   * Turning one OFF withdraws what is already published, because otherwise
   * "off" would only mean "no new rows" while old ones stayed visible. Turning
   * PRs ON backfills, so comparing works immediately instead of looking empty
   * until the next workout.
   */
  async setPrefs(
    member: CurrentMemberContext,
    next: { shareSessions?: boolean; sharePrs?: boolean; shareStreak?: boolean },
  ) {
    const meId = this.me(member);
    const before = await this.prefs(member);

    await this.pub.appUser.update({
      where: { id: meId },
      data: {
        ...(next.shareSessions !== undefined ? { share_sessions: next.shareSessions } : {}),
        ...(next.sharePrs !== undefined ? { share_prs: next.sharePrs } : {}),
        ...(next.shareStreak !== undefined ? { share_streak: next.shareStreak } : {}),
      },
    });

    if (next.shareSessions === false && before.shareSessions) {
      await this.publisher.withdraw(meId, 'sessions');
    }
    if (next.sharePrs === false && before.sharePrs) {
      await this.publisher.withdraw(meId, 'prs');
    }
    if (next.sharePrs === true && !before.sharePrs) {
      await this.publisher.backfillPrs(member);
    }

    return this.prefs(member);
  }

  /**
   * Send one of my routines to a friend.
   *
   * Mints an ordinary share snapshot and records the delivery. Reusing
   * shared_routines means the receiver's import is the SAME name-matching path
   * that link sharing already proved — a second copy mechanism would be a
   * second thing to keep correct as routines gain fields.
   *
   * The receiver gets a COPY. Later edits by the sender never reach them, which
   * is what "add it to mine" has to mean if a routine is not to change under
   * someone mid-session.
   */
  async sendRoutine(member: CurrentMemberContext, routineId: string, toAppUserId: string) {
    const meId = this.me(member);
    await this.assertFriend(meId, toAppUserId);

    // share() resolves the routine through the member's own scope, so a routine
    // id belonging to someone else simply does not exist here.
    const snap = await this.routines.share(member, routineId);

    await this.pub.friendRoutineShare.create({
      data: {
        from_app_user_id: meId,
        to_app_user_id: toAppUserId,
        token: snap.token,
        routine_name: snap.name,
      },
    });
    return { sent: true, name: snap.name, exerciseCount: snap.exerciseCount };
  }

  /** Routines friends have sent me, newest first. */
  async routineInbox(member: CurrentMemberContext) {
    const meId = this.me(member);
    const rows = await this.pub.friendRoutineShare.findMany({
      where: { to_app_user_id: meId },
      orderBy: { created_at: 'desc' },
      take: 30,
      include: { from_app_user: { select: { full_name: true } } },
    });
    return {
      shares: rows.map((r) => ({
        id: r.id,
        token: r.token,
        name: r.routine_name,
        from: r.from_app_user.full_name ?? 'MuscleX member',
        sentAt: r.created_at.toISOString(),
        importedAt: r.imported_at?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Accept a sent routine into my own list.
   *
   * Requires a gym: the import re-matches exercise names against the receiver's
   * own catalogue, and a gym-less user has no catalogue to match against.
   */
  async acceptRoutine(member: CurrentMemberContext, shareId: string) {
    const meId = this.me(member);
    if (!member.memberId) {
      throw MemberException.badRequest('Join a gym to add a routine.');
    }
    const share = await this.pub.friendRoutineShare.findUnique({ where: { id: shareId } });
    if (!share || share.to_app_user_id !== meId) {
      throw MemberException.notFound('Routine not found.');
    }

    const result = await this.routines.importShared(member, share.token);
    await this.pub.friendRoutineShare.update({
      where: { id: shareId },
      data: { imported_at: new Date() },
    });
    return result;
  }

  private async findPair(a: string, b: string) {
    return this.pub.friendship.findFirst({
      where: {
        OR: [
          { requester_id: a, addressee_id: b },
          { requester_id: b, addressee_id: a },
        ],
      },
    });
  }
}
