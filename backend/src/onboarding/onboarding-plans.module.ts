import { Module } from '@nestjs/common';
import { OnboardingPlansController } from './onboarding-plans.controller';
import { InternalController } from './internal.controller';
import { OnboardingPlansService } from './onboarding.service';

@Module({
  controllers: [OnboardingPlansController, InternalController],
  providers: [OnboardingPlansService],
  exports: [OnboardingPlansService],
})
export class OnboardingPlansModule {}
