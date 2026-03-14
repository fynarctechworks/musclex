import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class ApiMetadataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Generate or propagate request ID
    const requestId = request.headers['x-request-id'] || randomUUID();
    request.requestId = requestId;

    // Set headers early (before response is sent)
    response.setHeader('X-Request-ID', requestId);
    response.setHeader('X-API-Version', 'v1');

    // Tenant context
    if (request.user?.studio_id) {
      response.setHeader('X-Tenant-ID', request.user.studio_id);
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        response.setHeader('X-Response-Time', `${duration}ms`);
      }),
    );
  }
}
