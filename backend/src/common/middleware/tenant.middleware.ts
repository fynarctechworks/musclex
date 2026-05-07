import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContext } from '../tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  async use(req: Request, _res: Response, next: NextFunction) {
    // Middleware runs BEFORE guards, so req.user isn't populated yet.
    // We decode the JWT ourselves (without verification) to extract studio_id.
    // Security is enforced by JwtAuthGuard which properly verifies the token.
    let studioId: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Decode payload without verification (guard will verify)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          studioId = payload?.user_metadata?.studio_id;
        }
      } catch {
        // Malformed token — let the guard reject
      }
    }

    if (!studioId) {
      return tenantContext.run({ schemaName: '', gymId: '', activeBranchId: null, allowedBranchIds: [], bypassBranchScope: false }, () => next());
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(studioId)) {
      return tenantContext.run({ schemaName: '', gymId: '', activeBranchId: null, allowedBranchIds: [], bypassBranchScope: false }, () => next());
    }

    // Look up the actual schema_name from the Studio record
    let schemaName: string | undefined;
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ schema_name: string }>>(
        `SELECT schema_name FROM public.studios WHERE id = $1::uuid LIMIT 1`,
        studioId,
      );
      schemaName = rows?.[0]?.schema_name;
    } catch (err) {
      this.logger.error(`Failed to look up schema for studio ${studioId}: ${err.message}`);
      return tenantContext.run({ schemaName: '', gymId: '', activeBranchId: null, allowedBranchIds: [], bypassBranchScope: false }, () => next());
    }

    if (!schemaName || !/^studio_[0-9a-f_]+$/i.test(schemaName)) {
      return tenantContext.run({ schemaName: '', gymId: '', activeBranchId: null, allowedBranchIds: [], bypassBranchScope: false }, () => next());
    }

    return tenantContext.run(
      { schemaName, gymId: studioId, activeBranchId: null, allowedBranchIds: [], bypassBranchScope: false },
      () => next(),
    );
  }
}
