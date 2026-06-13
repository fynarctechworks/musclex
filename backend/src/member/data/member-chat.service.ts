import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { TRAINER_CHAT_MESSAGE, TrainerChatMessagePayload } from './chat.events';
import type {
  ChatThreadListData,
  ChatMessageListData,
  ChatMessageData,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER CHAT SERVICE (Member App V2.3 — Trainer Chat)
 * ────────────────────────────────────────────────────────────────
 *
 * 1:1 member ↔ trainer messaging. The conversation set is governed by
 * TrainerClient — a member can only message a trainer they are actively assigned
 * to (the trainer-gate), enforced server-side on every call. Every query is
 * member_id-scoped on top of the gym_id the tenant layer injects. Text-only for
 * now (voice notes / image sharing need signed object storage — deferred, not
 * faked); near-real-time via client polling until a WS gateway lands.
 */
@Injectable()
export class MemberChatService {
  constructor(
    private readonly tenant: TenantPrisma,
    private readonly events: EventEmitter2,
  ) {}

  /** One thread per active trainer assignment, with last message + unread count. */
  async threads(member: CurrentMemberContext): Promise<ChatThreadListData> {
    const links = await this.tenant.client.trainerClient.findMany({
      where: { member_id: member.memberId, status: 'active' },
      select: { trainer_id: true },
    });
    if (links.length === 0) return { threads: [] };

    const trainerIds = links.map((l) => l.trainer_id);
    const trainers = await this.tenant.client.staff.findMany({
      where: { id: { in: trainerIds } },
      select: { id: true, full_name: true },
    });
    const nameById = new Map(trainers.map((t) => [t.id, t]));

    const threads = await Promise.all(
      trainerIds.map(async (trainerId) => {
        const [last, unreadCount] = await Promise.all([
          this.tenant.client.trainerChatMessage.findFirst({
            where: { member_id: member.memberId, trainer_id: trainerId },
            orderBy: { created_at: 'desc' },
            select: { body: true, created_at: true },
          }),
          this.tenant.client.trainerChatMessage.count({
            where: {
              member_id: member.memberId,
              trainer_id: trainerId,
              sender: 'trainer',
              read_by_member_at: null,
            },
          }),
        ]);
        const t = nameById.get(trainerId);
        return {
          trainerId,
          trainerName: t?.full_name ?? 'Trainer',
          trainerAvatarUrl: null, // Staff has no photo column yet

          lastMessage: last?.body ?? null,
          lastMessageAt: last?.created_at ? last.created_at.toISOString() : null,
          unreadCount,
        };
      }),
    );

    // Most recent conversation first; never-messaged threads sink to the bottom.
    threads.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
    return { threads };
  }

  /** Messages with a trainer; marks the trainer's messages as read. 404 if the
   * member isn't actively assigned to that trainer (the trainer-gate). */
  async messages(
    member: CurrentMemberContext,
    trainerId: string,
  ): Promise<ChatMessageListData> {
    const trainer = await this.assertTrainer(member, trainerId);

    const rows = await this.tenant.client.trainerChatMessage.findMany({
      where: { member_id: member.memberId, trainer_id: trainerId },
      orderBy: { created_at: 'asc' },
      take: 200,
      select: { id: true, sender: true, body: true, created_at: true },
    });

    // Mark the trainer's messages read (idempotent housekeeping).
    await this.tenant.client.trainerChatMessage.updateMany({
      where: {
        member_id: member.memberId,
        trainer_id: trainerId,
        sender: 'trainer',
        read_by_member_at: null,
      },
      data: { read_by_member_at: new Date() },
    });

    return {
      trainerId,
      trainerName: trainer.full_name ?? 'Trainer',
      messages: rows.map((m) => ({
        id: m.id,
        sender: m.sender === 'trainer' ? 'trainer' : 'member',
        body: m.body,
        createdAt: m.created_at.toISOString(),
      })),
    };
  }

  /** Send a message to a trainer. Idempotent on (gym_id, client_key). */
  async send(
    member: CurrentMemberContext,
    trainerId: string,
    body: string,
    idempotencyKey?: string,
  ): Promise<ChatMessageData> {
    await this.assertTrainer(member, trainerId);

    const text = (body ?? '').trim();
    if (!text) throw MemberException.badRequest('Message body is required.');

    if (idempotencyKey) {
      const existing = await this.tenant.client.trainerChatMessage.findFirst({
        where: { client_key: idempotencyKey, member_id: member.memberId },
        select: { id: true, sender: true, body: true, created_at: true },
      });
      if (existing) {
        return {
          id: existing.id,
          sender: 'member',
          body: existing.body,
          createdAt: existing.created_at.toISOString(),
        };
      }
    }

    const msg = await this.tenant.client.trainerChatMessage.create({
      data: {
        gym_id: member.tenantId,
        member_id: member.memberId,
        trainer_id: trainerId,
        sender: 'member',
        body: text,
        client_key: idempotencyKey ?? null,
        read_by_member_at: new Date(), // the member authored it — read by them
      },
      select: { id: true, body: true, created_at: true },
    });

    const createdAt = msg.created_at.toISOString();

    // Fan out live over WebSocket (the member's other devices + the trainer).
    const payload: TrainerChatMessagePayload = {
      gymId: member.tenantId,
      memberId: member.memberId,
      trainerId,
      message: { id: msg.id, sender: 'member', body: msg.body, createdAt, trainerId },
    };
    this.events.emit(TRAINER_CHAT_MESSAGE, payload);

    return { id: msg.id, sender: 'member', body: msg.body, createdAt };
  }

  // ── helpers ────────────────────────────────────────────────────

  /** The trainer-gate: confirm an active TrainerClient link + return the staff. */
  private async assertTrainer(
    member: CurrentMemberContext,
    trainerId: string,
  ): Promise<{ full_name: string | null }> {
    const link = await this.tenant.client.trainerClient.findFirst({
      where: { member_id: member.memberId, trainer_id: trainerId, status: 'active' },
      select: { id: true },
    });
    if (!link) throw MemberException.notFound('Trainer not found.');
    const trainer = await this.tenant.client.staff.findFirst({
      where: { id: trainerId },
      select: { full_name: true },
    });
    return { full_name: trainer?.full_name ?? null };
  }
}
