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
import * as jose from 'jose';
import { ConfigService } from '@nestjs/config';

/**
 * DashboardGateway — Real-time WebSocket for dashboard metrics.
 *
 * Clients join a room `dashboard:{gym_id}` and receive push updates
 * whenever metrics change (member created, staff added, payment recorded, etc).
 *
 * SECURITY: JWT is verified on connection. studio_id is extracted from the
 * verified token, NOT from client-supplied data. Clients can only join rooms
 * for their own studio.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'dashboard',
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Return the number of currently-connected dashboard sockets.
   * Used by SystemStatusService for the "WebSocket healthy / N clients" probe.
   * Falls back to 0 if the server hasn't initialized yet (early boot).
   */
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

      // Verify JWT and extract studio_id from the VERIFIED payload
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`WS connection rejected: invalid token (socket=${socket.id})`);
        socket.emit('error', { message: 'Invalid or expired token' });
        socket.disconnect(true);
        return;
      }

      const studioId = payload.studio_id;
      if (!studioId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studioId)) {
        this.logger.warn(`WS connection rejected: no studio_id in token (socket=${socket.id})`);
        socket.emit('error', { message: 'No studio associated with this account' });
        socket.disconnect(true);
        return;
      }

      // Store verified studio_id on the socket for later use
      (socket as any).studioId = studioId;
      (socket as any).userId = payload.sub;

      socket.join(`dashboard:${studioId}`);
      this.logger.debug(`Client ${socket.id} joined dashboard:${studioId} (user=${payload.sub})`);
    } catch (err) {
      this.logger.error(`WS connection error: ${err}`, (err as Error).stack);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    this.logger.debug(`Client ${socket.id} disconnected`);
  }

  @SubscribeMessage('dashboard.subscribe')
  handleSubscribe(
    @MessageBody() data: { studio_id: string },
    @ConnectedSocket() socket: Socket,
  ) {
    // Only allow subscribing to the studio from the verified JWT
    const verifiedStudioId = (socket as any).studioId;
    if (!verifiedStudioId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (data.studio_id !== verifiedStudioId) {
      this.logger.warn(
        `TENANT VIOLATION: socket ${socket.id} tried to subscribe to studio ${data.studio_id} but belongs to ${verifiedStudioId}`,
      );
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    socket.join(`dashboard:${verifiedStudioId}`);
    socket.emit('dashboard.subscribed', { studio_id: verifiedStudioId });
  }

  // ── Push methods (called by DashboardMetricsService) ──────────

  /**
   * Broadcast a metrics delta to all clients watching this gym's dashboard.
   * The frontend merges this delta into its local state for instant UI update.
   */
  pushMetricsUpdate(gymId: string, delta: Record<string, number | string>) {
    this.server?.to(`dashboard:${gymId}`).emit('dashboard.metrics_updated', {
      gym_id: gymId,
      delta,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push a new activity feed item (e.g., "John checked in", "New member added").
   */
  pushActivityItem(gymId: string, activity: {
    type: string;
    message: string;
    member_name?: string;
    timestamp: Date;
  }) {
    this.server?.to(`dashboard:${gymId}`).emit('dashboard.activity', {
      gym_id: gymId,
      ...activity,
      timestamp: activity.timestamp.toISOString(),
    });
  }

  /**
   * Push a full metrics snapshot (used after resync or initial load).
   */
  pushFullSnapshot(gymId: string, metrics: Record<string, any>) {
    this.server?.to(`dashboard:${gymId}`).emit('dashboard.snapshot', {
      gym_id: gymId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Private helpers ──────────────────────────────────────────

  private async verifyToken(token: string): Promise<{ sub: string; studio_id: string } | null> {
    // Try Supabase JWT verification first (ES256)
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      if (supabaseUrl) {
        const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
        const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
        const { payload } = await jose.jwtVerify(token, jwks, {
          audience: 'authenticated',
        });
        const meta = (payload as any).user_metadata || {};
        return {
          sub: payload.sub || '',
          studio_id: meta.studio_id || '',
        };
      }
    } catch {
      // Fall through to local JWT verification
    }

    // Fallback: local JWT secret (for dev/testing)
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (secret) {
        const key = new TextEncoder().encode(secret);
        const { payload } = await jose.jwtVerify(token, key);
        return {
          sub: (payload as any).user_id || payload.sub || '',
          studio_id: (payload as any).studio_id || '',
        };
      }
    } catch {
      // Token invalid
    }

    return null;
  }
}
