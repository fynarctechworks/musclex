import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SccReporterService } from './scc-reporter.service';

/**
 * Forwards unhandled / server-side errors to the SCC Error Center, in addition
 * to (not instead of) Sentry. Runs as an APP_INTERCEPTOR so it wraps every HTTP
 * handler: on a thrown error it fires a fire-and-forget report and rethrows
 * untouched, so the existing SentryGlobalFilter and the normal error response
 * are completely unaffected.
 *
 * Expected client errors (HttpException < 500) are skipped to avoid noise —
 * only true server faults and database errors are reported.
 */
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly reporter: SccReporterService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http' || !this.reporter.enabled) {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      catchError((err) => {
        try {
          this.maybeReport(err, req);
        } catch {
          /* reporting must never affect the request */
        }
        return throwError(() => err);
      }),
    );
  }

  private maybeReport(err: unknown, req: any): void {
    const e = err as { status?: number; getStatus?: () => number; message?: string; stack?: string; constructor?: { name?: string } };
    const status =
      (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) ?? 500;

    // Skip expected client errors (validation, 401/403/404, throttling, etc.).
    if (err instanceof HttpException && status < 500) return;

    const isPrisma = Boolean(e?.constructor?.name?.startsWith('PrismaClient'));

    this.reporter.report({
      message: e?.message || 'Unhandled backend error',
      source: isPrisma ? 'DATABASE' : status >= 500 ? 'BACKEND' : 'API',
      severity: status >= 500 ? 'HIGH' : 'MEDIUM',
      stack_trace: e?.stack,
      api_endpoint: `${req?.method ?? ''} ${req?.route?.path ?? req?.url ?? ''}`.trim(),
      http_status: status,
      tenant_id:
        req?.tenantSchema || req?.tenant?.schema_name || req?.user?.studio_slug || undefined,
      user_id: req?.user?.sub || req?.user?.id || undefined,
    });
  }
}
