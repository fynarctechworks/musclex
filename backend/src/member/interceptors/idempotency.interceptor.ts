import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, from, throwError } from 'rxjs';
import { concatMap, catchError } from 'rxjs/operators';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import {
  CurrentMemberContext,
  MEMBER_REQUEST_KEY,
} from '../decorators/current-member.decorator';
import { MemberException } from '../common/member-exception';
import { IdempotencyService, IdempotencyKeyRef } from '../idempotency/idempotency.service';

/**
 * Enforces Idempotency-Key semantics on routes marked @Idempotent().
 *
 * Ordering: register AFTER TenantContextInterceptor and BEFORE EnvelopeInterceptor
 * so the value captured/replayed is the final enveloped response body.
 *   @UseInterceptors(TenantContextInterceptor, IdempotencyInterceptor, EnvelopeInterceptor)
 *
 * Flow: claim the key atomically. A repeated completed key replays its stored
 * response; an in-flight or differently-bodied reuse is a 409; a fresh claim
 * runs the handler, persists the response on success, and releases on failure.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return next.handle();

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const member = req[MEMBER_REQUEST_KEY] as CurrentMemberContext | undefined;
    if (!member) {
      // Idempotent routes are always member-guarded; this is a wiring error.
      throw MemberException.invalidToken('Missing member context.');
    }

    const key = this.readKey(req.headers['idempotency-key']);
    if (!key) throw MemberException.idempotencyKeyRequired();

    const ref: IdempotencyKeyRef = {
      tenantId: member.tenantId,
      memberId: member.memberId,
      key,
      endpoint: `${req.method} ${context.getClass().name}#${context.getHandler().name}`,
      requestHash: this.idempotency.hashRequest(req.body),
    };

    const claim = await this.idempotency.claim(ref);

    if (claim.kind === 'replay') {
      res.status(claim.status);
      return of(claim.body);
    }
    if (claim.kind === 'conflict') {
      if (claim.reason === 'key_reused') {
        throw MemberException.conflict(
          'This Idempotency-Key was already used with a different request.',
        );
      }
      // in_progress / race — the original is still running; safe to retry later.
      throw MemberException.conflict(
        'A request with this Idempotency-Key is already in progress.',
        true,
      );
    }

    // Fresh claim — run the handler, then persist/release based on outcome.
    return next.handle().pipe(
      concatMap(async (body) => {
        await this.idempotency.complete(ref, res.statusCode ?? 201, body);
        return body;
      }),
      catchError((err) =>
        from(this.idempotency.release(ref)).pipe(
          concatMap(() => throwError(() => err)),
        ),
      ),
    );
  }

  /** Accept a non-empty, reasonably bounded key (contract: uuid). */
  private readKey(raw: unknown): string | null {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 255) return null;
    return trimmed;
  }
}
