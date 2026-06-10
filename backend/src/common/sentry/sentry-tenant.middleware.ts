import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getTenantGymId } from '../tenant-context';
import { attachSentryRequestScope } from './sentry.context';

/**
 * Runs after TenantMiddleware so that the AsyncLocalStorage tenant store is
 * populated. Attaches gym_id + route + (hashed) user id to the Sentry scope
 * for the rest of the request — any captured error inherits these tags.
 */
@Injectable()
export class SentryTenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (process.env.SENTRY_DSN) {
      attachSentryRequestScope(req, getTenantGymId());
    }
    next();
  }
}
