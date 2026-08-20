import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { loadViewerScope } from './activity-visibility';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER PEOPLE SERVICE — finding other members
 * ────────────────────────────────────────────────────────────────
 *
 * Three ways in, in descending order of how much they give away:
 *
 *   SUGGESTIONS   derived from connections the member already has. Costs
 *                 nothing and reveals nothing new.
 *   QR / CODE     deliberate, in-person, one person at a time.
 *   CONTACTS      matched on HASHES, so no address book ever reaches us.
 *
 * All `public` / app_user scoped — no gym_id, no studio schema.
 */
@Injectable()
export class MemberPeopleService {
  /** One phone book's worth per request; beyond this it is not a contact list. */
  private static readonly MAX_HASHES = 2000;

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The salt mixed into contact hashes.
   *
   * Shared with the app, so it is not a secret in the cryptographic sense — see
   * the migration for what hashing does and does not buy. It exists so digests
   * are specific to this product, and so it can be rotated.
   */
  private salt(): string {
    return this.config.get<string>('PEOPLE_MATCH_SALT') ?? 'musclex.contacts.v1';
  }

  /**
   * People worth suggesting, from connections the member already has:
   *
   *   1. people followed by those they follow (the classic second degree)
   *   2. members of their clubs
   *   3. people they are already mutual friends with but do not follow
   *
   * Nothing here reveals a relationship the member could not already see, and
   * anyone blocked in either direction is excluded.
   */
  async suggestions(member: CurrentMemberContext) {
    const meId = member.appUserId;
    const scope = await loadViewerScope(this.pub, meId);
    const exclude = new Set<string>([meId, ...scope.following, ...scope.blocked]);

    const [secondDegree, clubMates, friends] = await Promise.all([
      scope.following.length
        ? this.pub.follow.findMany({
            where: { follower_id: { in: scope.following } },
            select: { followee_id: true },
            take: 200,
          })
        : Promise.resolve([]),
      this.pub.clubMember.findMany({
        where: {
          club: { members: { some: { app_user_id: meId } } },
          app_user_id: { not: meId },
        },
        select: { app_user_id: true },
        take: 200,
      }),
      this.pub.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ requester_id: meId }, { addressee_id: meId }],
        },
        select: { requester_id: true, addressee_id: true },
        take: 200,
      }),
    ]);

    // Count how many routes lead to each person — someone reachable three ways
    // is a better suggestion than someone reachable one.
    const score = new Map<string, { score: number; reasons: Set<string> }>();
    const add = (id: string, reason: string) => {
      if (exclude.has(id)) return;
      const cur = score.get(id) ?? { score: 0, reasons: new Set<string>() };
      cur.score += 1;
      cur.reasons.add(reason);
      score.set(id, cur);
    };

    for (const f of secondDegree) add(f.followee_id, 'followed by people you follow');
    for (const c of clubMates) add(c.app_user_id, 'in a club with you');
    for (const f of friends) {
      add(f.requester_id === meId ? f.addressee_id : f.requester_id, 'already your friend');
    }

    const ids = [...score.keys()].slice(0, 100);
    if (ids.length === 0) return { people: [] };

    const people = await this.pub.appUser.findMany({
      where: { id: { in: ids } },
      select: { id: true, full_name: true },
    });

    return {
      people: people
        .map((p) => ({
          id: p.id,
          name: p.full_name,
          reason: [...(score.get(p.id)?.reasons ?? [])][0] ?? 'suggested',
          score: score.get(p.id)?.score ?? 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map(({ score: _s, ...rest }) => rest),
    };
  }

  /**
   * Match hashed contacts.
   *
   * The app hashes locally and sends digests only, so no address book reaches
   * this server. The comparison hashes every app_user's phone tail on the fly:
   * correct, and fine at current size, but it is a sequential scan — at scale
   * this wants a stored hash column keyed to the salt in use.
   */
  async matchContacts(member: CurrentMemberContext, hashes: string[]) {
    if (!Array.isArray(hashes) || hashes.length === 0) return { people: [] };
    if (hashes.length > MemberPeopleService.MAX_HASHES) {
      throw MemberException.badRequest(
        `Send at most ${MemberPeopleService.MAX_HASHES} contacts at a time.`,
      );
    }

    const clean = [...new Set(hashes.filter((h) => /^[a-f0-9]{64}$/i.test(h)).map((h) => h.toLowerCase()))];
    if (clean.length === 0) return { people: [] };

    const scope = await loadViewerScope(this.pub, member.appUserId);

    // Raw SQL because the digest happens in the database. No gym_id filter is
    // required or possible: app_users is a `public` table with no tenant
    // column, which is exactly why it is safe to query this way.
    const rows = await this.pub.$queryRaw<{ id: string; full_name: string | null }[]>`
      SELECT id, full_name
        FROM public.app_users
       WHERE phone_tail <> ''
         AND encode(extensions.digest(phone_tail || ${this.salt()}, 'sha256'), 'hex') = ANY(${clean})
       LIMIT 200
    `;

    const skip = new Set([member.appUserId, ...scope.blocked]);
    return {
      people: rows
        .filter((r) => !skip.has(r.id))
        .map((r) => ({
          id: r.id,
          name: r.full_name,
          following: scope.following.includes(r.id),
        })),
    };
  }

  /**
   * A person's public card, by id — what a QR scan resolves to.
   *
   * Deliberately thin: a name, and whether you already follow them. Anything
   * more would make an id, which is not a secret, into a way to read somebody's
   * profile.
   */
  async profile(member: CurrentMemberContext, appUserId: string) {
    const scope = await loadViewerScope(this.pub, member.appUserId);
    if (scope.blocked.includes(appUserId)) {
      throw MemberException.notFound('Person not found.');
    }
    const p = await this.pub.appUser.findUnique({
      where: { id: appUserId },
      select: { id: true, full_name: true },
    });
    if (!p) throw MemberException.notFound('Person not found.');

    const [followers, following] = await Promise.all([
      this.pub.follow.count({ where: { followee_id: appUserId } }),
      this.pub.follow.count({ where: { follower_id: appUserId } }),
    ]);

    return {
      id: p.id,
      name: p.full_name,
      followerCount: followers,
      followingCount: following,
      youFollow: scope.following.includes(appUserId),
      isYou: appUserId === member.appUserId,
    };
  }

  /** What this member's own QR encodes. */
  async myCode(member: CurrentMemberContext) {
    return { appUserId: member.appUserId, link: `musclex://u/${member.appUserId}` };
  }
}
