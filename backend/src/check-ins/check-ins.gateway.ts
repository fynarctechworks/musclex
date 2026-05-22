import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import {
  CHECK_IN_DENIED,
  CHECK_IN_OVERRIDDEN,
  CHECK_IN_RECORDED,
  OCCUPANCY_UPDATED,
  type CheckInDeniedPayload,
  type CheckInOverriddenPayload,
  type CheckInRecordedPayload,
  type OccupancyUpdatedPayload,
} from './check-in.events';

/**
 * CheckInsGateway — Real-time WebSocket for the check-in domain.
 *
 * Rooms:
 *   - `branch:{branch_id}`  Joined by clients viewing one branch (kiosk, reception)
 *   - `gym:{gym_id}`        Joined by all clients in the tenant (multi-branch dashboards)
 *
 * Auth: JWT verified on connection. studio_id and branch_ids extracted from
 * the verified token. Clients can only subscribe to branches they have
 * access to.
 *
 * Events emitted (server → client):
 *   - `check_in.recorded`     Successful check-in
 *   - `check_in.denied`       Denied attempt (member can see this)
 *   - `check_in.overridden`   Staff override accepted
 *   - `occupancy.updated`     Branch occupancy snapshot
 *
 * Events received (client → server):
 *   - `check_in.subscribe`    { branch_id }   join a branch room
 *   - `check_in.unsubscribe`  { branch_id }   leave a branch room
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'check-ins',
})
export class CheckInsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CheckInsGateway.name);

  constructor(private readonly configService: ConfigService) {}

  getClientCount(): number {
    try {
      return this.server?.sockets?.sockets?.size ?? 0;
    } catch {
      return 0;
    }
  }

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`WS connection rejected: no token (socket=${socket.id})`);
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect(true);
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`WS connection rejected: invalid token (socket=${socket.id})`);
        socket.emit('error', { message: 'Invalid or expired token' });
        socket.disconnect(true);
        return;
      }

      if (!payload.studio_id || !UUID_RE.test(payload.studio_id)) {
        this.logger.warn(`WS connection rejected: no studio_id (socket=${socket.id})`);
        socket.emit('error', { message: 'No studio associated with this account' });
        socket.disconnect(true);
        return;
      }

      (socket as any).studioId = payload.studio_id;
      (socket as any).userId = payload.sub;
      (socket as any).branchIds = payload.branch_ids ?? [];

      socket.join(`gym:${payload.studio_id}`);
      this.logger.debug(
        `Client ${socket.id} joined gym:${payload.studio_id} (user=${payload.sub}, branches=${(payload.branch_ids ?? []).length})`,
      );
    } catch (err) {
      this.logger.error(`WS connection error: ${err}`, (err as Error).stack);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    this.logger.debug(`Client ${socket.id} disconnected`);
  }

  @SubscribeMessage('check_in.subscribe')
  handleSubscribe(
    @MessageBody() data: { branch_id: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const studioId = (socket as any).studioId as string | undefined;
    const branchIds = (socket as any).branchIds as string[] | undefined;

    if (!studioId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!data?.branch_id || !UUID_RE.test(data.branch_id)) {
      socket.emit('error', { message: 'Invalid branch_id' });
      return;
    }

    // Branch-scope enforcement: branch_ids[] empty means "all branches in this studio"
    if (branchIds && branchIds.length > 0 && !branchIds.includes(data.branch_id)) {
      this.logger.warn(
        `BRANCH SCOPE VIOLATION: socket=${socket.id} (user=${(socket as any).userId}) tried to subscribe to branch ${data.branch_id} but only has access to [${branchIds.join(', ')}]`,
      );
      socket.emit('error', { message: 'Access denied for this branch' });
      return;
    }

    socket.join(`branch:${data.branch_id}`);
    socket.emit('check_in.subscribed', { branch_id: data.branch_id });
  }

  @SubscribeMessage('check_in.unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { branch_id: string },
    @ConnectedSocket() socket: Socket,
  ) {
    if (!data?.branch_id) return;
    socket.leave(`branch:${data.branch_id}`);
    socket.emit('check_in.unsubscribed', { branch_id: data.branch_id });
  }

  // ── Push fan-out via EventEmitter2 ─────────────────────────────

  @OnEvent(CHECK_IN_RECORDED, { async: true })
  onCheckInRecorded(payload: CheckInRecordedPayload) {
    this.server?.to(`branch:${payload.branch_id}`).emit('check_in.recorded', payload);
    this.server?.to(`gym:${payload.gym_id}`).emit('check_in.recorded', payload);
  }

  @OnEvent(CHECK_IN_DENIED, { async: true })
  onCheckInDenied(payload: CheckInDeniedPayload) {
    this.server?.to(`branch:${payload.branch_id}`).emit('check_in.denied', payload);
  }

  @OnEvent(CHECK_IN_OVERRIDDEN, { async: true })
  onCheckInOverridden(payload: CheckInOverriddenPayload) {
    this.server?.to(`branch:${payload.branch_id}`).emit('check_in.overridden', payload);
    this.server?.to(`gym:${payload.gym_id}`).emit('check_in.overridden', payload);
  }

  @OnEvent(OCCUPANCY_UPDATED, { async: true })
  onOccupancyUpdated(payload: OccupancyUpdatedPayload) {
    this.server?.to(`branch:${payload.branch_id}`).emit('occupancy.updated', payload);
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async verifyToken(
    token: string,
  ): Promise<{ sub: string; studio_id: string; branch_ids?: string[] } | null> {
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      if (supabaseUrl) {
        const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
        const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
        const { payload } = await jose.jwtVerify(token, jwks, { audience: 'authenticated' });
        const meta = (payload as any).user_metadata || {};
        return {
          sub: payload.sub || '',
          studio_id: meta.studio_id || '',
          branch_ids: meta.branch_ids ?? [],
        };
      }
    } catch {
      // fall through
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (secret) {
        const key = new TextEncoder().encode(secret);
        const { payload } = await jose.jwtVerify(token, key);
        return {
          sub: (payload as any).user_id || payload.sub || '',
          studio_id: (payload as any).studio_id || '',
          branch_ids: (payload as any).branch_ids ?? [],
        };
      }
    } catch {
      // invalid
    }

    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
