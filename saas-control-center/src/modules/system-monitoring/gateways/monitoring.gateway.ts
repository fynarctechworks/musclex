import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle } from '@nestjs/throttler';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * Realtime feed for the Monitoring Center (`/monitoring` namespace).
 *
 * Auth: the admin JWT is verified during the socket handshake (handleConnection),
 * so message handlers don't need the HTTP guards — the gateway is marked
 * @Public()/@SkipThrottle() to keep the global APP_GUARDs from running in the
 * WS context. Server→client events: `error:new`, `error:updated`,
 * `alert:critical`. Acknowledging alerts is done over REST, not here, to avoid a
 * gateway↔AlertService dependency cycle.
 *
 * Single-instance today; for multi-instance fan-out add @socket.io/redis-adapter
 * (see docs/ERROR_CENTER_ARCHITECTURE.md).
 */
@Public()
@SkipThrottle()
@WebSocketGateway({
  namespace: '/monitoring',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? '*').split(',').map((o) => o.trim()),
    credentials: true,
  },
})
export class MonitoringGateway implements OnGatewayConnection {
  private readonly logger = new Logger(MonitoringGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      client.data.adminId = payload.sub;
      client.data.filters = {};
    } catch {
      client.emit('unauthorized', { message: 'Invalid or missing token' });
      client.disconnect(true);
    }
  }

  /** Client opts into a filtered view; stored on the socket for future use. */
  @SubscribeMessage('subscribe')
  onSubscribe(client: Socket, filters: Record<string, unknown>) {
    client.data.filters = filters ?? {};
    return { ok: true };
  }

  emitErrorNew(payload: unknown): void {
    this.safeEmit('error:new', payload);
  }

  emitErrorUpdated(payload: unknown): void {
    this.safeEmit('error:updated', payload);
  }

  emitAlertCritical(payload: unknown): void {
    this.safeEmit('alert:critical', payload);
  }

  private safeEmit(event: string, payload: unknown): void {
    // server is undefined until the gateway is initialized; never let a realtime
    // emit failure break ingestion.
    try {
      this.server?.emit(event, payload);
    } catch (err) {
      this.logger.warn(`Failed to emit ${event}: ${(err as Error).message}`);
    }
  }

  private extractToken(client: Socket): string {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!raw) throw new Error('No token');
    return String(raw).replace(/^Bearer\s+/i, '');
  }
}
