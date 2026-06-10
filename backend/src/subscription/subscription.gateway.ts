import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import {
  SubscriptionContext,
  SubscriptionLifecycleStatus,
} from '../common/decorators/current-user.decorator';

/**
 * Real-time push channel for subscription lifecycle changes.
 *
 * - Clients connect to namespace `/subscription`, authenticated via JWT.
 * - Each socket joins room `subscription:{studio_id}` — the only room their
 *   verified studio_id may join. Tenant isolation enforced server-side.
 * - When the cron or a renewal triggers a status transition, the policy
 *   service calls pushStatusChange() to fan out to every connected admin.
 *
 * Mirrors the pattern in DashboardGateway so the frontend uses the same
 * Socket.IO client setup.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'subscription',
})
export class SubscriptionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SubscriptionGateway.name);

  constructor(private readonly configService: ConfigService) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect(true);
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload?.studio_id) {
        socket.emit('error', { message: 'Invalid or expired token' });
        socket.disconnect(true);
        return;
      }

      (socket as any).studioId = payload.studio_id;
      (socket as any).userId = payload.sub;

      socket.join(`subscription:${payload.studio_id}`);
      this.logger.debug(
        `WS connect: ${socket.id} joined subscription:${payload.studio_id}`,
      );
    } catch (err) {
      this.logger.error(`WS connect error: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    this.logger.debug(`WS disconnect: ${socket.id}`);
  }

  /**
   * Broadcast a subscription state change to every admin watching this studio.
   * Called from SubscriptionPolicyService (after recompute) and the renewal
   * endpoint.
   */
  pushStatusChange(
    studioId: string,
    payload: {
      previous_status: SubscriptionLifecycleStatus;
      subscription: SubscriptionContext;
      reason: 'cron_recompute' | 'renewal' | 'admin_action' | 'webhook';
    },
  ): void {
    this.server
      ?.to(`subscription:${studioId}`)
      .emit('subscription.status_changed', {
        studio_id: studioId,
        timestamp: new Date().toISOString(),
        ...payload,
      });
  }

  /**
   * Daily heartbeat — push the current state to all connected clients so a
   * frontend that lost a transition event can self-heal on the next tick.
   */
  pushHeartbeat(studioId: string, subscription: SubscriptionContext): void {
    this.server
      ?.to(`subscription:${studioId}`)
      .emit('subscription.heartbeat', {
        studio_id: studioId,
        timestamp: new Date().toISOString(),
        subscription,
      });
  }

  // ── Private ───────────────────────────────────────────────

  private async verifyToken(
    token: string,
  ): Promise<{ sub: string; studio_id: string } | null> {
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      if (supabaseUrl) {
        const jwks = jose.createRemoteJWKSet(
          new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
        );
        const { payload } = await jose.jwtVerify(token, jwks, {
          audience: 'authenticated',
        });
        const meta = (payload as any).user_metadata || {};
        return { sub: payload.sub || '', studio_id: meta.studio_id || '' };
      }
    } catch {
      /* fall through */
    }

    try {
      const secret = this.configService.get<string>('SUPABASE_JWT_SECRET');
      if (secret) {
        const key = new TextEncoder().encode(secret);
        const { payload } = await jose.jwtVerify(token, key);
        const meta = (payload as any).user_metadata || {};
        return { sub: payload.sub || '', studio_id: meta.studio_id || '' };
      }
    } catch {
      /* invalid */
    }
    return null;
  }
}
