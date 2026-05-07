import { Controller, Get, Query } from '@nestjs/common';
import { OnboardingPlansService } from './onboarding.service';

@Controller('api/v1/onboarding')
export class OnboardingPlansController {
  constructor(
    private readonly onboardingPlansService: OnboardingPlansService,
  ) {}

  @Get('plans')
  getPlans(@Query('type') type?: string) {
    return this.onboardingPlansService.getPublicPlans(type as any);
  }
}
