import { Global, Module } from '@nestjs/common';
import { SubscriptionPolicyService } from '../common/services/subscription-policy.service';
import { SubscriptionLockGuard } from '../common/guards/subscription-lock.guard';
import { SubscriptionGateway } from './subscription.gateway';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCron } from './subscription.cron';
import { CronLockService } from '../common/services/cron-lock.service';

/**
 * Global subscription lifecycle module.
 *
 * - Exposes SubscriptionPolicyService (pure compute + ledger writes)
 * - Provides SubscriptionLockGuard (registered as APP_GUARD in AppModule)
 * - Hosts the SubscriptionGateway for real-time status pushes
 * - Owns the renewal endpoints and daily recompute cron
 *
 * Made @Global() so JwtAuthGuard (used cross-module via @UseGuards) can inject
 * SubscriptionPolicyService without each consumer importing this module.
 *
 * PrismaModule and QueueModule are already global; EventEmitter is global too.
 */
@Global()
@Module({
  imports: [],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionPolicyService,
    SubscriptionLockGuard,
    SubscriptionGateway,
    SubscriptionService,
    SubscriptionCron,
    CronLockService,
  ],
  exports: [
    SubscriptionPolicyService,
    SubscriptionLockGuard,
    SubscriptionGateway,
  ],
})
export class SubscriptionModule {}
