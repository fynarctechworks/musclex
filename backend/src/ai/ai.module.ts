import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourceLimitService } from '../common/services/resource-limit.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, ResourceLimitService],
  exports: [AiService],
})
export class AiModule {}
