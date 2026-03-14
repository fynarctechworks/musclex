import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Tenant safety audit middleware — defense-in-depth layer.
    // Primary isolation is via SET search_path in TenantMiddleware.
    this.$use(async (params, next) => {
      if (!params.model) return next(params);

      // Models in the public schema don't need tenant scoping
      const publicModels = [
        'Studio',
        'StudioInvitation',
        'LoginAttempt',
        'GlobalConfig',
      ];

      if (publicModels.includes(params.model)) return next(params);

      // Log write operations when audit mode is enabled
      const writeActions = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'];
      if (writeActions.includes(params.action) && process.env.TENANT_AUDIT_LOG === 'true') {
        this.logger.debug(`Tenant write: ${params.model}.${params.action}`);
      }

      return next(params);
    });
  }

  async onModuleInit() {
    try {
      const connectPromise = this.$connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000),
      );
      await Promise.race([connectPromise, timeoutPromise]);
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.warn(
        `Database connection failed: ${error.message}. API will start but DB queries will fail.`,
      );
    }
  }

  /**
   * Verify that the current connection's search_path matches the expected tenant.
   * Use in critical operations (payments, PII access) as defense-in-depth.
   */
  async verifyTenantContext(expectedStudioId: string): Promise<boolean> {
    const result = await this.$queryRaw<Array<{ current_setting: string }>>`
      SELECT current_setting('search_path') as current_setting
    `;
    const currentPath = result?.[0]?.current_setting || '';
    const expectedSchema = `studio_${expectedStudioId.replace(/-/g, '_')}`;
    return currentPath.includes(expectedSchema);
  }
}
