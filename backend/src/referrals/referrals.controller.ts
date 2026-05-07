import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../common';
import { ValidateReferralCodeDto } from './dto/validate-referral.dto';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ProcessSubscriptionEventDto } from './dto/process-event.dto';

@Controller('api/v1/referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  /**
   * GET /api/v1/referrals/validate?code=XYZ123
   * Public — called during onboarding before login exists.
   * Rate-limited to prevent code enumeration.
   *
   * Response 200:
   * { valid: true, referrer_name: "Iron Temple Gym" }
   * { valid: false, message: "Invalid referral code" }
   */
  @Get('validate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  validateCode(@Query() dto: ValidateReferralCodeDto) {
    return this.referralsService.validateCode(dto.code);
  }

  /**
   * POST /api/v1/referrals
   * Authenticated — called during or after onboarding.
   * Links the calling studio as the "referred" gym.
   *
   * Body: { referral_code: "XYZ123", referred_email?: "gym@example.com" }
   *
   * Response 201:
   * { referral_id: "uuid" }
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createReferral(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReferralDto,
  ) {
    return this.referralsService.createReferral(user.studio_id, dto);
  }

  /**
   * GET /api/v1/referrals/stats
   * Authenticated — returns the studio's referral code and reward history.
   *
   * Response 200:
   * {
   *   referral_code: "XYZ123",
   *   subscription_expires_at: "2026-06-01T00:00:00Z",
   *   stats: { total: 5, pending: 3, rewarded: 2 },
   *   recent_rewards: [{ reward_type, reward_value, applied_at, extended_to, referred_gym }]
   * }
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats(@CurrentUser() user: JwtPayload) {
    return this.referralsService.getReferralStats(user.studio_id);
  }

  /**
   * POST /api/v1/referrals/events/subscription-activated
   * Internal / webhook — called by payment gateway webhooks or billing service.
   * In production, protect with an API key guard or internal network policy.
   *
   * Body: ProcessSubscriptionEventDto
   *
   * Response 202: { accepted: true }
   */
  @Post('events/subscription-activated')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async subscriptionActivated(@Body() dto: ProcessSubscriptionEventDto) {
    await this.referralsService.processSubscriptionActivated(dto);
    return { accepted: true };
  }
}
