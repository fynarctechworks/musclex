import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicPortalService } from './public-portal.service';
import { PublicCheckoutDto, PublicCheckoutVerifyDto, PublicLeadDto } from './dto';

/**
 * Unauthenticated per-gym portal. NO auth guards by design — these endpoints
 * expose only public-safe gym marketing data and prospect-initiated writes,
 * all resolved from the slug via the registry and tightly rate-limited.
 */
@Controller('api/v1/public/gyms')
export class PublicPortalController {
  constructor(private readonly portal: PublicPortalService) {}

  @Get(':slug')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  profile(@Param('slug') slug: string) {
    return this.portal.gymProfile(slug);
  }

  @Get(':slug/classes')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  classes(@Param('slug') slug: string, @Query('branch_id') branchId?: string) {
    return this.portal.upcomingClasses(slug, branchId);
  }

  @Post(':slug/leads')
  @HttpCode(201)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  createLead(@Param('slug') slug: string, @Body() dto: PublicLeadDto) {
    return this.portal.createLead(slug, dto);
  }

  @Post(':slug/checkout')
  @HttpCode(201)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  checkout(@Param('slug') slug: string, @Body() dto: PublicCheckoutDto) {
    return this.portal.checkout(slug, dto);
  }

  @Post(':slug/checkout/verify')
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  verify(@Param('slug') slug: string, @Body() dto: PublicCheckoutVerifyDto) {
    return this.portal.verifyCheckout(slug, dto);
  }
}

/**
 * Hosted-checkout context (member-app renewals paid in the browser). Separate
 * controller because it is order-scoped, not slug-scoped.
 */
@Controller('api/v1/public/checkout')
export class PublicCheckoutController {
  constructor(private readonly portal: PublicPortalService) {}

  @Get(':orderId')
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  orderContext(@Param('orderId') orderId: string) {
    return this.portal.orderContext(orderId);
  }
}
