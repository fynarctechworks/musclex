import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtPayload } from '../decorators/current-user.decorator';

const ALWAYS_STRIP: ReadonlySet<string> = new Set([
  'face_descriptor',
  'face_embedding',
  'payment_method_token',
  'card_token',
  'cvv',
  'password',
  'password_hash',
  'two_factor_secret',
  'api_key_secret',
  'refresh_token',
  'reset_token',
]);

const OWNER_ONLY: ReadonlySet<string> = new Set([
  'salary',
  'base_salary',
  'hourly_rate',
]);

const OWNER_ROLES: ReadonlySet<string> = new Set(['owner', 'brand_owner']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v);
}

function strip(value: unknown, isOwner: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => strip(v, isOwner));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (ALWAYS_STRIP.has(k)) continue;
    if (!isOwner && OWNER_ONLY.has(k)) continue;
    out[k] = strip(v, isOwner);
  }
  return out;
}

@Injectable()
export class StripSecretsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const user = req?.user as JwtPayload | undefined;
    const isOwner = !!user && OWNER_ROLES.has(user.role);

    return next.handle().pipe(
      map((data) => {
        // @Res() handlers: controller already wrote the response; don't touch the Response object.
        if (res?.headersSent) return data;
        if (data && typeof (data as any).send === 'function' && typeof (data as any).setHeader === 'function') {
          return data;
        }
        return strip(data, isOwner);
      }),
    );
  }
}
