import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

export const API_DEPRECATION_KEY = 'api_deprecation';

export interface ApiDeprecationMeta {
  deprecated: boolean;
  sunset?: string; // ISO date when the endpoint will be removed
  replacement?: string; // URL of the replacement endpoint
  message?: string;
}

/**
 * Decorator to mark an endpoint as deprecated.
 * Usage: @ApiDeprecated({ sunset: '2025-12-31', replacement: '/api/v2/members' })
 */
export const ApiDeprecated = (meta: Omit<ApiDeprecationMeta, 'deprecated'>) =>
  SetMetadata(API_DEPRECATION_KEY, { ...meta, deprecated: true });

@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();

    // Check for deprecation metadata on handler or controller
    const deprecation = this.reflector.getAllAndOverride<ApiDeprecationMeta>(
      API_DEPRECATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (deprecation?.deprecated) {
      response.setHeader('X-API-Deprecated', 'true');

      if (deprecation.sunset) {
        response.setHeader('X-API-Sunset', deprecation.sunset);
      }
      if (deprecation.replacement) {
        response.setHeader('X-API-Replacement', deprecation.replacement);
        response.setHeader(
          'Link',
          `<${deprecation.replacement}>; rel="successor-version"`,
        );
      }
      if (deprecation.message) {
        response.setHeader('X-API-Deprecation-Notice', deprecation.message);
      }
    }

    return next.handle();
  }
}
