import { Module } from '@nestjs/common';
import { GymOwnerLeadsService } from './gym-owner-leads.service';
import { GymOwnerLeadsController } from './gym-owner-leads.controller';

/**
 * Gym-owner enquiries captured on the public marketing website.
 * AuditLogsModule is @Global, so AuditLogsService needs no explicit import.
 */
@Module({
  providers: [GymOwnerLeadsService],
  controllers: [GymOwnerLeadsController],
  exports: [GymOwnerLeadsService],
})
export class GymOwnerLeadsModule {}
