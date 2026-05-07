import { Module, forwardRef } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchProvisioningService } from './branch-provisioning.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ResourceLimitService } from '../common/services/resource-limit.service';

@Module({
  imports: [PrismaModule, forwardRef(() => EventsModule)],
  controllers: [BranchesController],
  providers: [BranchesService, BranchProvisioningService, ResourceLimitService],
  exports: [BranchesService],
})
export class BranchesModule {}
