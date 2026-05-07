import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { DiscountService } from './discount.service';
import { DiscountController } from './discount.controller';

@Module({
  providers: [PlansService, DiscountService],
  controllers: [PlansController, DiscountController],
  exports: [PlansService, DiscountService],
})
export class PlansModule {}
