import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';
import { TenantContextService } from '../common/middleware/tenant-context.service';
import { TenantClientFactory } from './tenant-client.factory';
import { PublicPrismaService } from './public-prisma.service';
import { TenantPrisma } from './tenant-prisma.accessor';
import { TenantTaskRunner } from './tenant-task-runner';

// ── Per-gym physical-schema clients (Road B) ──────────────────────────────────
// PublicPrismaService = registry (public schema). TenantPrisma = current gym's
// schema client, via the leak-safe TenantClientFactory. These run ALONGSIDE the
// legacy multiSchema PrismaService during the service-by-service rewiring; the
// legacy client is removed only at cutover.
const tenantClientFactoryProvider = {
  provide: TenantClientFactory,
  useFactory: () => new TenantClientFactory(process.env.DATABASE_URL),
};

@Global()
@Module({
  providers: [
    PrismaService,
    TenantPrismaService,
    TenantContextService,
    tenantClientFactoryProvider,
    PublicPrismaService,
    TenantPrisma,
    TenantTaskRunner,
  ],
  exports: [
    PrismaService,
    TenantPrismaService,
    TenantContextService,
    TenantClientFactory,
    PublicPrismaService,
    TenantPrisma,
    TenantTaskRunner,
  ],
})
export class PrismaModule {}
