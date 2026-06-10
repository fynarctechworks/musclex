import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { IdempotencyService } from './idempotency.service';
import { BillingGatewayModule } from './gateway/billing-gateway.module';

@Module({
  imports: [BillingGatewayModule],
  providers: [BillingService, IdempotencyService],
  controllers: [BillingController],
  exports: [BillingService, BillingGatewayModule],
})
export class BillingModule {}
