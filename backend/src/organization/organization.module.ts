import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { RegionController } from './region.controller';
import { RegionService } from './region.service';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationController, RegionController, FranchiseController],
  providers: [OrganizationService, RegionService, FranchiseService],
  exports: [OrganizationService, RegionService, FranchiseService],
})
export class OrganizationModule {}
