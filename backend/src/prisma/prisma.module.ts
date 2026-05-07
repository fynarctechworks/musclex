import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';
import { TenantContextService } from '../common/middleware/tenant-context.service';

@Global()
@Module({
  providers: [PrismaService, TenantPrismaService, TenantContextService],
  exports: [PrismaService, TenantPrismaService, TenantContextService],
})
export class PrismaModule {}
