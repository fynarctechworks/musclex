import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, from, throwError } from 'rxjs';
import { concatMap, catchError } from 'rxjs/operators';
import { STAFF_IDEMPOTENT_KEY } from './idempotent.decorator';
import { IdempotencyStore, IdempotencyRef } from './idempotency-store.service';

/**
 * Idempotency for staff financial mutations marked @Idempotent().
 *
 * The `Idempotency-Key` header is optional: with no header the handler runs as
 * usual (backwards compatible). With a header, a repeated completed key replays
 * the stored response; an in-flight or differently-bodied reuse is a 409.
 *
 * Scoped by tenant (studio_id) + acting user so keys can't collide across gyms.
 * Fails OPEN on a store outage — a cache problem must never block a real payment.
 */
@Injectable()
export class StaffIdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: IdempotencyStore,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const enabled = this.reflector.getAllAndOverride<boolean>(STAFF_IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!enabled) return next.handle();

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const key = this.readKey(req.headers?.['idempotency-key']);
    if (!key) return next.handle(); // header optional — no key, no dedup

    const user = req.user as { studio_id?: string; user_id?: string } | undefined;
    // Without an authenticated tenant/user we cannot scope a key safely — skip
    // dedup rather than risk a cross-tenant collision.
    if (!user?.studio_id || !user?.user_id) return next.handle();

    const ref: IdempotencyRef = {
      tenantId: user.studio_id,
      userId: user.user_id,
      endpoint: `${req.method} ${context.getClass().name}#${context.getHandler().name}`,
      key,
      requestHash: this.store.hashRequest(req.body),
    };

    const claim = await this.store.claim(ref);

    if (claim.kind === 'replay') {
      res.status(claim.status);
      return of(claim.body);
    }
    if (claim.kind === 'conflict') {
      throw new ConflictException(
        claim.reason === 'key_reused'
          ? 'This Idempotency-Key was already used with a different request.'
          : 'A request with this Idempotency-Key is already in progress.',
      );
    }

    // Fresh claim — run the handler, persist on success, release on failure so a
    // genuine retry isn't permanently blocked by a transient error.
    return next.handle().pipe(
      concatMap(async (body) => {
        await this.store.complete(ref, res.statusCode ?? 201, body);
        return body;
      }),
      catchError((err) =>
        from(this.store.release(ref)).pipe(concatMap(() => throwError(() => err))),
      ),
    );
  }

  private readKey(raw: unknown): string | null {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 255) return null;
    return trimmed;
  }
}
