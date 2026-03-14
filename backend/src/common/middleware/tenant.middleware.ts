import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (user?.studio_id) {
      // Validate studio_id is a valid UUID to prevent SQL injection
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user.studio_id)) {
        throw new ForbiddenException('Invalid studio identifier');
      }

      const schemaName = `studio_${user.studio_id.replace(/-/g, '_')}`;

      // Double-validate resulting schema name only contains safe characters
      if (!/^studio_[0-9a-f_]+$/i.test(schemaName)) {
        throw new ForbiddenException('Invalid schema name');
      }

      try {
        // Verify the schema actually exists before setting search_path
        const schemaExists = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
          `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) as exists`,
          schemaName,
        );

        if (!schemaExists?.[0]?.exists) {
          this.logger.error(`Tenant schema "${schemaName}" does not exist for studio ${user.studio_id}`);
          throw new ForbiddenException('Studio environment not initialized. Please complete onboarding.');
        }

        await this.prisma.$executeRawUnsafe(
          `SET search_path TO "${schemaName}", public`,
        );
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        this.logger.error(`Failed to set tenant schema "${schemaName}": ${err.message}`);
        throw new ForbiddenException('Unable to access studio environment');
      }
    }

    next();
  }
}
