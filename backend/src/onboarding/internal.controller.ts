import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OnboardingPlansService } from './onboarding.service';

@Controller('api/v1/internal')
export class InternalController {
  constructor(
    private readonly onboardingPlansService: OnboardingPlansService,
  ) {}

  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  invalidateCache(
    @Headers('x-internal-secret') secret: string,
    @Body('key') key: string,
  ) {
    const expected = process.env.INTERNAL_API_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    this.onboardingPlansService.invalidateCache(key);
    return { success: true, invalidated: key };
  }
}
