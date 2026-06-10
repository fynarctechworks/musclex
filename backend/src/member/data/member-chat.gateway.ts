import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MemberTokenService } from '../auth/member-token.service';
import { TRAINER_CHAT_MESSAGE, TrainerChatMessagePayload } from './chat.events';

/**
 * MemberChatGateway — real-time trainer chat (V2.3 → V2.4 real-time upgrade).
 *
 * Mirrors the check-in gateway pattern. Auth: the MEMBER access token is verified
 * on the handshake (same MemberTokenService as the BFF — aud=member, MEMBER_JWT_SECRET),
 * so only authenticated members connect and `memberId`/`tenantId` come ONLY from the
 * verified token (never the client). Each member joins their own room `member:{id}`.
 *
 * Sends still go over REST (idempotent + offline outbox); this gateway only PUSHES:
 * when a message is created the service fires TRAINER_CHAT_MESSAGE and we fan it out
 * live to the member's devices (`member:{id}`) and the trainer (`staff:{trainerId}`,
 * joined by the trainer app when it exists). Polling remains a fallback.
 *
 * Events received (client → server): `chat:typing` { trainerId }
 * Events emitted (server → client): `chat:message`, `chat:typing`
 */
@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, namespace: 'member-chat' })
export class MemberChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MemberChatGateway.name);

  constructor(private readonly tokens: MemberTokenService) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return this.deny(socket, 'Authentication required');

      const claims = await this.tokens.verifyAccessToken(token); // throws if invalid
      // Chat is a gym feature: a gym-less PUBLIC user has no member scope.
      if (!claims.memberId || !claims.tenantId) {
        return this.deny(socket, 'Chat is only available to gym members');
      }
      (socket as any).memberId = claims.memberId;
      (socket as any).tenantId = claims.tenantId;
      socket.join(`member:${claims.memberId}`);
      socket.emit('chat:ready', { memberId: claims.memberId });
    } catch {
      this.deny(socket, 'Invalid or expired token');
    }
  }

  private deny(socket: Socket, message: string) {
    socket.emit('error', { message });
    socket.disconnect(true);
  }

  /** Relay a member's "typing" to the trainer's room (the trainer app joins it). */
  @SubscribeMessage('chat:typing')
  handleTyping(
    @MessageBody() data: { trainerId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const memberId = (socket as any).memberId as string | undefined;
    const tenantId = (socket as any).tenantId as string | undefined;
    if (!memberId || !data?.trainerId) return;
    this.server
      ?.to(`staff:${data.trainerId}`)
      .emit('chat:typing', { memberId, trainerId: data.trainerId, gymId: tenantId });
  }

  // ── Push fan-out ───────────────────────────────────────────────
  @OnEvent(TRAINER_CHAT_MESSAGE, { async: true })
  onMessage(payload: TrainerChatMessagePayload) {
    // The member's own devices (so a message sent on phone shows on tablet too).
    this.server?.to(`member:${payload.memberId}`).emit('chat:message', payload.message);
    // The trainer (their app joins `staff:{id}`), with the member context attached.
    this.server
      ?.to(`staff:${payload.trainerId}`)
      .emit('chat:message', { ...payload.message, memberId: payload.memberId });
  }
}
