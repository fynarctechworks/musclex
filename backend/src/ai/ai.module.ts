import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolRunnerService } from './ai-tool-runner.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourceLimitService } from '../common/services/resource-limit.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, AiToolRunnerService, ResourceLimitService],
  exports: [AiService],
})
export class AiModule {}
