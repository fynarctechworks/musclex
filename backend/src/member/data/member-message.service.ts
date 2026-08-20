import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { loadViewerScope } from './activity-visibility';
import type { ReportDto } from './dto';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER MESSAGE SERVICE — direct messages, and the guards around them
 * ────────────────────────────────────────────────────────────────
 *
 * A DM is the first place a stranger can put text in front of somebody who did
 * not ask for it. Three guards, all enforced server-side:
 *
 *   BLOCK          stops it in either direction, and neither party is told
 *                  which of them did the blocking.
 *   message_privacy  the recipient's own rule — everyone / followers / nobody.
 *                  Defaults to 'followers'.
 *   REPORT         always available, on any thread, without needing a block
 *                  first — the two are different decisions.
 *
 * All `public` / app_user scoped: no gym_id, no studio schema, no cross-tenant
 * surface.
 */
@Injectable()
export class MemberMessageService {
  private static readonly BODY_MAX = 2000;
  private static readonly PAGE = 50;

  constructor(private readonly pub: PublicPrismaService) {}

  /** The pair, ordered — the shape the unique index expects. */
  private pair(x: string, y: string): [string, string] {
    return x < y ? [x, y] : [y, x];
  }

  private other(c: { member_a_id: string; member_b_id: string }, meId: string) {
    return c.member_a_id === meId ? c.member_b_id : c.member_a_id;
  }

  /**
   * May `meId` open a thread with `themId`?
   *
   * Refusals are deliberately indistinguishable from "person not found": a
   * distinct "you are blocked" would tell somebody they had been blocked,
   * which is exactly what a block is meant to avoid.
   */
  private async assertMayMessage(meId: string, themId: string) {
    if (meId === themId) throw MemberException.badRequest('You cannot message yourself.');

    const them = await this.pub.appUser.findUnique({
      where: { id: themId },
      select: { id: true, message_privacy: true },
    });
    if (!them) throw MemberException.notFound('Person not found.');

    const scope = await loadViewerScope(this.pub, meId);
    if (scope.blocked.includes(themId)) throw MemberException.notFound('Person not found.');

    if (them.message_privacy === 'nobody') {
      throw MemberException.badRequest('This person is not accepting messages.');
    }
    if (them.message_privacy === 'followers') {
      // "Followers" means THEY follow ME — the recipient decided whose
      // messages they want, so it is their following list that counts.
      const follows = await this.pub.follow.findFirst({
        where: { follower_id: themId, followee_id: meId },
        select: { id: true },
      });
      if (!follows) {
        throw MemberException.badRequest(
          'This person only accepts messages from people they follow.',
        );
      }
    }
  }

  /** Find or create the one thread between two people. */
  async open(member: CurrentMemberContext, themId: string) {
    await this.assertMayMessage(member.appUserId, themId);
    const [a, b] = this.pair(member.appUserId, themId);

    const convo = await this.pub.conversation.upsert({
      where: { member_a_id_member_b_id: { member_a_id: a, member_b_id: b } },
      create: { member_a_id: a, member_b_id: b },
      update: {},
    });
    return { id: convo.id, withId: themId };
  }

  async list(member: CurrentMemberContext) {
    const meId = member.appUserId;
    const scope = await loadViewerScope(this.pub, meId);

    const rows = await this.pub.conversation.findMany({
      where: {
        OR: [{ member_a_id: meId }, { member_b_id: meId }],
        // A blocked person's thread leaves the inbox entirely.
        AND: [
          { member_a_id: { notIn: scope.blocked } },
          { member_b_id: { notIn: scope.blocked } },
        ],
      },
      orderBy: { last_message_at: 'desc' },
      include: {
        member_a: { select: { id: true, full_name: true } },
        member_b: { select: { id: true, full_name: true } },
        reads: { where: { app_user_id: meId }, select: { last_read_at: true } },
        messages: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { body: true, created_at: true, sender_id: true },
        },
      },
    });

    return {
      conversations: await Promise.all(
        rows.map(async (c) => {
          const otherId = this.other(c, meId);
          const them = c.member_a_id === otherId ? c.member_a : c.member_b;
          const lastRead = c.reads[0]?.last_read_at ?? new Date(0);
          const unread = await this.pub.directMessage.count({
            where: {
              conversation_id: c.id,
              deleted_at: null,
              // Your own messages are never unread to you.
              sender_id: { not: meId },
              created_at: { gt: lastRead },
            },
          });
          return {
            id: c.id,
            with: { id: them.id, name: them.full_name },
            lastMessage: c.messages[0]
              ? {
                  body: c.messages[0].body,
                  at: c.messages[0].created_at.toISOString(),
                  mine: c.messages[0].sender_id === meId,
                }
              : null,
            unread,
          };
        }),
      ),
    };
  }

  private async mine(conversationId: string, meId: string) {
    const c = await this.pub.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ member_a_id: meId }, { member_b_id: meId }],
      },
    });
    if (!c) throw MemberException.notFound('Conversation not found.');
    return c;
  }

  async messages(member: CurrentMemberContext, conversationId: string) {
    const meId = member.appUserId;
    const c = await this.mine(conversationId, meId);

    const scope = await loadViewerScope(this.pub, meId);
    if (scope.blocked.includes(this.other(c, meId))) {
      throw MemberException.notFound('Conversation not found.');
    }

    const rows = await this.pub.directMessage.findMany({
      where: { conversation_id: conversationId, deleted_at: null },
      orderBy: { created_at: 'asc' },
      take: MemberMessageService.PAGE,
      select: { id: true, body: true, created_at: true, sender_id: true },
    });

    // Opening the thread IS reading it.
    await this.pub.conversationRead.upsert({
      where: {
        conversation_id_app_user_id: { conversation_id: conversationId, app_user_id: meId },
      },
      create: { conversation_id: conversationId, app_user_id: meId },
      update: { last_read_at: new Date() },
    });

    return {
      messages: rows.map((m) => ({
        id: m.id,
        body: m.body,
        at: m.created_at.toISOString(),
        mine: m.sender_id === meId,
      })),
    };
  }

  async send(member: CurrentMemberContext, conversationId: string, body: string) {
    const meId = member.appUserId;
    const c = await this.mine(conversationId, meId);
    // Re-checked on every send, not just when the thread was opened: a block
    // or a privacy change after the fact has to take effect immediately.
    await this.assertMayMessage(meId, this.other(c, meId));

    const text = (body ?? '').trim();
    if (!text) throw MemberException.badRequest('Write something first.');
    if (text.length > MemberMessageService.BODY_MAX) {
      throw MemberException.badRequest(
        `Messages are limited to ${MemberMessageService.BODY_MAX} characters.`,
      );
    }

    const m = await this.pub.directMessage.create({
      data: { conversation_id: conversationId, sender_id: meId, body: text },
    });
    await this.pub.conversation.update({
      where: { id: conversationId },
      data: { last_message_at: m.created_at },
    });
    return { id: m.id, body: m.body, at: m.created_at.toISOString(), mine: true };
  }

  /** Only the sender may retract, and only their own message. */
  async deleteMessage(member: CurrentMemberContext, messageId: string) {
    const m = await this.pub.directMessage.findUnique({
      where: { id: messageId },
      select: { id: true, sender_id: true, deleted_at: true },
    });
    if (!m || m.deleted_at || m.sender_id !== member.appUserId) {
      throw MemberException.notFound('Message not found.');
    }
    await this.pub.directMessage.update({
      where: { id: messageId },
      data: { deleted_at: new Date() },
    });
    return { deleted: true };
  }

  /** The recipient's own rule for who may start a thread with them. */
  async setMessagePrivacy(
    member: CurrentMemberContext,
    value: 'everyone' | 'followers' | 'nobody',
  ) {
    await this.pub.appUser.update({
      where: { id: member.appUserId },
      data: { message_privacy: value },
    });
    return { messagePrivacy: value };
  }

  /**
   * Report something.
   *
   * Deliberately NOT coupled to blocking: someone may want a thing looked at
   * without cutting the person off, or cut them off without filing anything.
   * Two decisions, two actions.
   */
  async report(member: CurrentMemberContext, dto: ReportDto) {
    const row = await this.pub.report.create({
      data: {
        reporter_id: member.appUserId,
        reported_id: dto.reportedId ?? null,
        target_kind: dto.targetKind,
        target_id: dto.targetId ?? null,
        reason: dto.reason.trim(),
        note: dto.note ?? null,
      },
    });
    // The reporter is told it was received and nothing about what happens
    // next — an outcome we cannot promise should not be implied.
    return { reported: true, id: row.id };
  }
}
