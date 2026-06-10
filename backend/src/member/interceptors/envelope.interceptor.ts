import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { buildMeta } from '../common/envelope';
import {
  CurrentMemberContext,
  MEMBER_REQUEST_KEY,
} from '../decorators/current-member.decorator';

/**
 * Wraps member data-endpoint responses in the standard { data, meta } envelope
 * (see member-api-v1.openapi.yaml → Envelope). Applied per-controller on the
 * data controllers — NOT on the auth controller, whose responses (OtpRequestResult,
 * SessionResult, TokenPair) are returned raw by contract.
 *
 * Pass-throughs:
 *   - null/undefined (e.g. 204 responses)
 *   - a value that is already an envelope ({ data, meta }) or an error envelope
 * A handler may set meta.cacheTtl by returning { data, meta: { cacheTtl } } itself.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const member = request[MEMBER_REQUEST_KEY] as CurrentMemberContext | undefined;

    return next.handle().pipe(
      map((body) => {
        if (body === null || body === undefined) return body;
        if (typeof body === 'object' && ('data' in body || 'error' in body)) {
          return body; // already enveloped (or an error envelope)
        }
        return { data: body, meta: buildMeta({ tenantId: member?.tenantId }) };
      }),
    );
  }
}
